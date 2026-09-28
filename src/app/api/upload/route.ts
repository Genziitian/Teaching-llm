import { NextRequest, NextResponse } from 'next/server'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { checkMagicBytes } from '@/lib/validation'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Server-side Supabase client using service role key (bypasses RLS for uploads)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url) throw new Error('Environment variable NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('Environment variable SUPABASE_SERVICE_ROLE_KEY is not set')
  
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Strict validation: Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate by magic bytes when possible, with a controlled extension fallback
    const detectedExt = await checkMagicBytes(buffer)
    const originalExt = (file.name.split('.').pop() || '').toLowerCase()
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'zip']
    const finalExt = detectedExt || originalExt

    if (!finalExt || !allowedExtensions.includes(finalExt)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, JPG, PNG, PPT, PPTX, DOC, DOCX, XLS, XLSX, ZIP.' }, { status: 400 })
    }

    const secureId = crypto.randomUUID()
    const normalizedExt = finalExt === 'jpeg' ? 'jpg' : finalExt
    const filename = `${secureId}.${normalizedExt}`

    const type = formData.get('type') as string || 'announcements'
    const allowedTypes = ['announcements', 'exams', 'updates', 'materials', 'store-notes', 'homework']
    const finalType = allowedTypes.includes(type) ? type : 'announcements'

    // Upload to Supabase Storage (bucket: lms-uploads or secure-notes)
    const supabase = getSupabaseAdmin()
    const isStoreNote = finalType === 'store-notes'
    const bucketName = isStoreNote ? 'secure-notes' : 'lms-uploads'

    if (isStoreNote) {
      try {
        const { data: buckets } = await supabase.storage.listBuckets()
        const exists = buckets?.some(b => b.id === 'secure-notes')
        if (!exists) {
          await supabase.storage.createBucket('secure-notes', { public: false })
        }
      } catch (err) {
        console.error('Failed to verify/create secure-notes bucket:', err)
      }
    }

    const storagePath = isStoreNote ? filename : `${finalType}/${filename}`

    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      png: 'image/png',
      pdf: 'application/pdf',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      zip: 'application/zip',
    }

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: contentTypeMap[normalizedExt] || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
    }

    // Get the permanent public URL (for private buckets this acts as the base URL to identify the file)
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error('Error uploading file:', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
