import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url) throw new Error('Environment variable NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('Environment variable SUPABASE_SERVICE_ROLE_KEY is not set')
  
  return createClient(url, key)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const note = await prisma.storeNote.findUnique({
      where: { id: params.id },
      include: { files: true }
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Verify access permission:
    // 1. User is ADMIN or MANAGER
    // 2. The note is free (price = 0)
    // 3. User has a valid active purchase (within 30 days)
    const isManager = user.role === 'MANAGER' || (user.role === 'ADMIN' || user.role === 'MODERATOR')
    const isFree = note.price === 0

    let hasAccess = isManager || isFree

    if (!hasAccess) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const purchaseAccess = await prisma.storeNoteAccess.findFirst({
        where: {
          noteId: note.id,
          userId: user.id,
          createdAt: { gt: thirtyDaysAgo }
        }
      })
      if (purchaseAccess) {
        hasAccess = true
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this note. Please purchase it first.' }, { status: 403 })
    }

    const noteFile = note.files?.[0]
    if (!noteFile || !noteFile.fileUrl) {
      return NextResponse.json({ error: 'No documents attached to this note.' }, { status: 404 })
    }

    let redirectUrl = noteFile.fileUrl
    const isSupabaseUrl = redirectUrl.includes('/storage/v1/object/')

    if (isSupabaseUrl) {
      const isSecureNoteBucket = redirectUrl.includes('/secure-notes/')
      const isLmsUploadsBucket = redirectUrl.includes('/lms-uploads/')

      if (isSecureNoteBucket || isLmsUploadsBucket) {
        const bucketName = isSecureNoteBucket ? 'secure-notes' : 'lms-uploads'
        const parts = redirectUrl.split(`/storage/v1/object/public/${bucketName}/`)
        const partsSign = redirectUrl.split(`/storage/v1/object/sign/${bucketName}/`)

        let storagePath = ''
        if (parts.length > 1) {
          storagePath = parts[1]
        } else if (partsSign.length > 1) {
          storagePath = partsSign[1].split('?')[0]
        }

        if (storagePath) {
          try {
            const supabase = getSupabaseAdmin()
            const { data, error } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(decodeURIComponent(storagePath), 60) // 60 seconds expiry

            if (!error && data?.signedUrl) {
              redirectUrl = data.signedUrl
            } else {
              console.error('Supabase signed URL creation failed:', error)
            }
          } catch (err) {
            console.error('Error generating Supabase signed URL:', err)
          }
        }
      }
    }

    return NextResponse.redirect(redirectUrl)
  } catch (error: any) {
    console.error('Error downloading note:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
