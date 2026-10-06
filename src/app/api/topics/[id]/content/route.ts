import { NextRequest, NextResponse } from 'next/server'
import { createContent } from '@/lib/content-publisher'
import { getSession, canManageContent } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canManageContent(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params


    const { title, description, videoUrl, youtubeUrl, pptUrl, videoSource, isDemo, duration } = await request.json()

    const content = await createContent({
        topicId: id,
        title,
        description,
        videoUrl,
        youtubeUrl,
        pptUrl,
        videoSource: videoSource || 'GOOGLE_DRIVE',
        isDemo: !!isDemo,
        duration: duration || null,
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.CONTENT_CREATED,
      actionDescription: `${session.name} created content "${title}"`,
      moduleName: MODULE.CONTENT,
      targetId: content.id,
    })

    return NextResponse.json(content)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
