import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const RETENTION_DAYS_AFTER_DUE = 7

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function extractStoragePath(publicUrl: string): string | null {
  const match = publicUrl.match(/\/object\/public\/lms-uploads\/(.+)$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isAuthorizedCron = Boolean(
      cronSecret && authHeader === `Bearer ${cronSecret}`
    )

    const session = await getSession()
    const isManager = session?.role === 'MANAGER' || session?.role === 'ADMIN'

    if (!isAuthorizedCron && !isManager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS_AFTER_DUE * 24 * 60 * 60 * 1000)

    // Keep homework and submission rows visible for managers/admins.
    // Only remove student-uploaded files after the retention window.
    const staleSubmissions = await prisma.homeworkSubmission.findMany({
      where: {
        fileUrls: { isEmpty: false },
        homework: {
          dueAt: { lt: cutoff },
        },
      },
      select: {
        id: true,
        fileUrls: true,
      },
    })

    const supabase = getSupabaseAdmin()
    let deletedFileCount = 0
    let clearedSubmissionCount = 0
    const storagePaths = staleSubmissions
      .flatMap(sub => sub.fileUrls)
      .map(extractStoragePath)
      .filter((path): path is string => Boolean(path))

    if (supabase && storagePaths.length > 0) {
      for (let i = 0; i < storagePaths.length; i += 100) {
        const chunk = storagePaths.slice(i, i + 100)
        const { error } = await supabase.storage.from('lms-uploads').remove(chunk)
        if (error) {
          console.error('[Homework Cleanup] Failed to remove submission files:', error)
        } else {
          deletedFileCount += chunk.length
        }
      }
    }

    for (const submission of staleSubmissions) {
      await prisma.homeworkSubmission.update({
        where: { id: submission.id },
        data: { fileUrls: [] },
      })
      clearedSubmissionCount++
    }

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS_AFTER_DUE,
      cutoff: cutoff.toISOString(),
      deletedHomeworkCount: 0,
      clearedSubmissionCount,
      deletedFileCount,
      storageConfigured: Boolean(supabase),
    })
  } catch (error: any) {
    console.error('Error during homework cleanup cron:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
