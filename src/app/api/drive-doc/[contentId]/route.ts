import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, isStudentEnrolledInContent } from '@/lib/auth'
import { extractDriveFileId, fetchDriveFileStream, getDriveAuthMode } from '@/lib/drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/drive-doc/[contentId]
 *
 * Streams a Google-Drive-hosted lecture material (PDF / slides) to the
 * authenticated, enrolled student. Same auth + enrollment gate as
 * /api/drive-stream, but pulls from `content.pptUrl` instead of `videoUrl`.
 *
 * The proxy forces `content-type: application/pdf` and `inline` disposition
 * so the in-app PDF viewer renders it directly without triggering a download
 * prompt. Range is forwarded so PDF viewers can request specific byte ranges
 * for fast page jumps on large documents.
 *
 * Returns:
 *   200 OK / 206 Partial Content — file bytes
 *   400 — pptUrl is malformed
 *   401 — not logged in
 *   403 — not enrolled in the lecture's course
 *   404 — content not found / no pptUrl
 *   502 — upstream Drive error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contentId } = await params

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        pptUrl: true,
        isDemo: true,
        topic: {
          select: {
            courseId: true,
            course: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!content) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
    }
    if (!content.pptUrl) {
      return NextResponse.json(
        { error: 'No material attached to this lecture' },
        { status: 404 }
      )
    }

    const privileged =
      isAdminOrManager(session.role) || session.role === 'INSTRUCTOR'
    if (!privileged) {
      const isEnrolled = await isStudentEnrolledInContent(
        session.userId,
        content.id,
        content.topic?.courseId
      )
      if (!isEnrolled) {
        return NextResponse.json(
          { error: 'You are not enrolled in this course' },
          { status: 403 }
        )
      }
    }

    const rangeHeader = request.headers.get('range')
    const fileId = extractDriveFileId(content.pptUrl)

    if (!fileId) {
      if (content.pptUrl.startsWith('http://') || content.pptUrl.startsWith('https://')) {
        try {
          const directRes = await fetch(content.pptUrl, {
            headers: rangeHeader ? { Range: rangeHeader } : undefined,
          })
          if (!directRes.ok) {
            return NextResponse.json({ error: 'Failed to fetch material from direct link' }, { status: directRes.status })
          }
          const headers = new Headers()
          directRes.headers.forEach((v, k) => {
            if (['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'].includes(k.toLowerCase())) {
              headers.set(k, v)
            }
          })
          headers.set('content-type', directRes.headers.get('content-type') || 'application/pdf')
          headers.set('content-disposition', 'inline')
          headers.set('cache-control', 'private, no-store')
          return new Response(directRes.body, { status: directRes.status, headers })
        } catch (fetchErr: any) {
          return NextResponse.json({ error: fetchErr?.message || 'Failed to fetch direct material' }, { status: 502 })
        }
      }
      return NextResponse.json(
        { error: 'Could not extract a Drive file ID from pptUrl' },
        { status: 400 }
      )
    }

    let upstream
    try {
      upstream = await fetchDriveFileStream(fileId, rangeHeader)
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e?.message || 'Drive fetch failed'
      const code = e?.code === 404 ? 404 : 502
      console.error('[drive-doc] upstream error', {
        fileId,
        mode: getDriveAuthMode(),
        msg,
      })
      return NextResponse.json({ error: msg }, { status: code })
    }

    const responseHeaders = new Headers()
    for (const [k, v] of Object.entries(
      upstream.headers as Record<string, string>
    )) {
      if (typeof v === 'string') responseHeaders.set(k, v)
    }

    const upstreamType = responseHeaders.get('content-type')
    if (upstreamType) responseHeaders.set('x-drive-content-type', upstreamType)
    if (upstreamType && upstreamType.includes('text/html')) {
      console.error('[drive-doc] upstream returned HTML instead of PDF', { fileId, upstreamType })
      return NextResponse.json(
        { error: 'Google Drive returned an HTML page instead of PDF bytes. Please verify that the file sharing is set to "Anyone with the link can view".' },
        { status: 502 }
      )
    }

    responseHeaders.set('content-type', 'application/pdf')
    responseHeaders.set('content-disposition', 'inline')
    if (!responseHeaders.has('accept-ranges')) {
      responseHeaders.set('accept-ranges', 'bytes')
    }
    responseHeaders.set('cache-control', 'private, no-store')
    responseHeaders.set('x-content-type-options', 'nosniff')

    const body = isWebStream(upstream.stream)
      ? upstream.stream
      : nodeToWebReadable(upstream.stream as NodeJS.ReadableStream)
    return new Response(body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (error: any) {
    console.error('Material stream error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function isWebStream(s: any): s is ReadableStream<Uint8Array> {
  return s && typeof (s as ReadableStream).getReader === 'function'
}

function nodeToWebReadable(node: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on('data', (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk))
      )
      node.on('end', () => controller.close())
      node.on('error', (err) => controller.error(err))
    },
    cancel() {
      ;(node as any).destroy?.()
    },
  })
}
