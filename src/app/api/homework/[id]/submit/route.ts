import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, getAccessibleCourseIds } from '@/lib/auth'
import { checkMagicBytes } from '@/lib/validation'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

const contentTypeMap: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const homework = await prisma.homework.findUnique({
      where: { id },
      select: { id: true, courseId: true, dueAt: true },
    })

    if (!homework) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 })
    }

    // Verify course access
    const isManager = isAdminOrManager(session.role)
    if (!isManager) {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
      if (accessibleCourseIds && !accessibleCourseIds.includes(homework.courseId)) {
        return NextResponse.json({ error: 'Access denied: not enrolled in this course' }, { status: 403 })
      }
    }

    let fileUrls: string[] = []
    let note: string | null = null

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      note = (formData.get('note') as string) || null

      const files = formData.getAll('files') as File[]
      const singleFile = formData.get('file') as File | null
      const allFiles = [...files]
      if (singleFile && !allFiles.includes(singleFile)) {
        allFiles.push(singleFile)
      }

      if (allFiles.length > 0) {
        const supabase = getSupabaseAdmin()
        if (!supabase) {
          return NextResponse.json({ error: 'Storage service unconfigured' }, { status: 500 })
        }

        const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'zip']

        for (const file of allFiles) {
          if (!file || typeof file === 'string') continue

          if (file.size > 15 * 1024 * 1024) {
            return NextResponse.json({ error: `File ${file.name} exceeds 15MB limit` }, { status: 400 })
          }

          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)

          const detectedExt = await checkMagicBytes(buffer)
          const originalExt = (file.name.split('.').pop() || '').toLowerCase()
          const finalExt = detectedExt || originalExt

          if (!finalExt || !allowedExtensions.includes(finalExt)) {
            return NextResponse.json({ error: `File type not allowed for ${file.name}` }, { status: 400 })
          }

          const secureId = crypto.randomUUID()
          const normalizedExt = finalExt === 'jpeg' ? 'jpg' : finalExt
          const filename = `${secureId}.${normalizedExt}`
          const storagePath = `homework-submissions/${filename}`

          const { error: uploadError } = await supabase.storage
            .from('lms-uploads')
            .upload(storagePath, buffer, {
              contentType: contentTypeMap[normalizedExt] || 'application/octet-stream',
              upsert: false,
            })

          if (uploadError) {
            console.error('Submission upload error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
          }

          const { data: urlData } = supabase.storage
            .from('lms-uploads')
            .getPublicUrl(storagePath)

          fileUrls.push(urlData.publicUrl)
        }
      }
    } else {
      const json = await request.json()
      if (Array.isArray(json.fileUrls)) {
        fileUrls = json.fileUrls
      }
      if (typeof json.note === 'string') {
        note = json.note.trim() || null
      }
    }

    if (fileUrls.length === 0 && !note) {
      return NextResponse.json({ error: 'Please attach at least one file or write a note' }, { status: 400 })
    }

    // Upsert student submission
    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId: id,
          studentId: session.userId,
        },
      },
      create: {
        homeworkId: id,
        studentId: session.userId,
        fileUrls,
        note,
      },
      update: {
        fileUrls,
        note,
        submittedAt: new Date(),
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(submission, { status: 200 })
  } catch (error: any) {
    console.error('Error submitting homework:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
