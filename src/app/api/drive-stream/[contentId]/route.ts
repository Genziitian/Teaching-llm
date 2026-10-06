import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, verifyStreamToken, isStudentEnrolledInContent } from '@/lib/auth'
import { extractDriveFileId, fetchDriveFileStream, getDriveAuthMode } from '@/lib/drive'

// Node runtime — googleapis + Node streams aren't available on Edge
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/drive-stream/[contentId]
 *
 * Streams a Google-Drive-hosted lecture video to the authenticated, enrolled
 * student. Honors HTTP Range so native <video> seeking works.
 *
 * The original Drive URL is never exposed to the browser — students only see
 * /api/drive-stream/{contentId} which requires their auth cookie. Pasting the
 * URL elsewhere → 401.
 *
 * Returns:
 *   200 OK / 206 Partial Content — video bytes
 *   400 — content is not a Drive video, or videoUrl is malformed
 *   401 — not logged in
 *   403 — not enrolled in the lecture's course
 *   404 — content not found / no videoUrl
 *   502 — upstream Drive error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params
    const token = request.nextUrl.searchParams.get('token')

    let userId: string
    let role: string

    if (token) {
      const decoded = verifyStreamToken(token)
      if (!decoded || decoded.lectureId !== contentId) {
        return NextResponse.json({ error: 'Unauthorized stream token' }, { status: 401 })
      }
      userId = decoded.userId
      role = decoded.role
    } else {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = session.userId
      role = session.role
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        strictDriveAccess: true,
        videoUrl: true,
        videoSource: true,
        isDemo: true,
        // JSON column added in 20260617090000_content_video_variants.
        // Cast at the lib boundary because Prisma's JsonValue type is `any`.
        videoVariants: true,
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
    if (!content.videoUrl) {
      return NextResponse.json({ error: 'No video attached to this lecture' }, { status: 404 })
    }
    if (content.videoSource !== 'GOOGLE_DRIVE') {
      return NextResponse.json(
        { error: `This endpoint only streams GOOGLE_DRIVE videos (got ${content.videoSource || 'unknown'})` },
        { status: 400 }
      )
    }

    // Quality picker — when `?quality=720p` is present and matches a key in
    // `videoVariants`, serve that file instead of the default. Unknown labels
    // silently fall back to the default to keep playback robust if the
    // manager later removes a variant.
    const requested = (request.nextUrl.searchParams.get('quality') || '').trim()
    let sourceUrl = content.videoUrl
    if (requested) {
      const variants = content.videoVariants as Record<string, string> | null
      const variantId = variants?.[requested]
      if (variantId && typeof variantId === 'string') {
        sourceUrl = variantId
      }
    }

    // Access control — managers / admins / instructors get a pass
    const privileged = isAdminOrManager(role) || role === 'INSTRUCTOR'
    if (!privileged) {
      const isEnrolled = await isStudentEnrolledInContent(userId, content.id, content.topic.courseId)
      if (!isEnrolled) {
        return NextResponse.json({ error: 'You are not enrolled in this course' }, { status: 403 })
      }
    }

    const fileId = extractDriveFileId(sourceUrl)
    if (!fileId) {
      return NextResponse.json({ error: 'Could not extract a Drive file ID from videoUrl' }, { status: 400 })
    }

    const rangeHeader = request.headers.get('range')

    let upstream
    try {
      upstream = await fetchDriveFileStream(fileId, rangeHeader, content.strictDriveAccess)
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e?.message || 'Drive fetch failed'
      const code = e?.code === 404 ? 404 : 502
      console.error('[drive-stream] upstream error', { fileId, mode: getDriveAuthMode(), msg })
      return NextResponse.json({ error: msg }, { status: code })
    }

    // Build response headers — forward upstream + apply our defaults
    const responseHeaders = new Headers()
    for (const [k, v] of Object.entries(upstream.headers as Record<string, string>)) {
      if (typeof v === 'string') responseHeaders.set(k, v)
    }
    if (!responseHeaders.has('content-type')) responseHeaders.set('content-type', 'video/mp4')
    if (!responseHeaders.has('accept-ranges')) responseHeaders.set('accept-ranges', 'bytes')
    // Never let intermediate proxies cache — each request must re-check auth
    responseHeaders.set('cache-control', 'private, no-store')

    // Convert Node Readable → Web ReadableStream (when needed)
    const body = isWebStream(upstream.stream) ? upstream.stream : nodeToWebReadable(upstream.stream as NodeJS.ReadableStream)
    return new Response(body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (error: any) {
    console.error('Lecture stream error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function isWebStream(s: any): s is ReadableStream<Uint8Array> {
  return s && typeof (s as ReadableStream).getReader === 'function'
}

function nodeToWebReadable(node: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      node.on('end', () => controller.close())
      node.on('error', err => controller.error(err))
    },
    cancel() {
      ;(node as any).destroy?.()
    },
  })
}
