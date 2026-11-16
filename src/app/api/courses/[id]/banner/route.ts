import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ensureCourseColumns } from '@/lib/course-schema-sync'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

// Course banner photo (shown on the course page header and the Courses list card).
// Recommended: 1600 x 750 px (32:15), JPG / PNG / WebP, max 5 MB.
const MAX_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Storage is not configured')
  return createClient(url, key)
}

async function guard() {
  const session = await getSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (session.role !== 'MANAGER') return { error: NextResponse.json({ error: 'Only managers can change the course photo' }, { status: 403 }) }
  return { session }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard()
    if (g.error) return g.error
    const session = g.session!
    await ensureCourseColumns()
    const { id } = await params

    const course = await prisma.course.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const form = await request.formData()
    const file = form.get('banner') as File | null
    if (!file) return NextResponse.json({ error: 'No image uploaded' }, { status: 400 })
    const ext = TYPES[file.type]
    if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP image' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is too large. Maximum 5 MB' }, { status: 400 })

    const supabase = supabaseAdmin()
    const path = `course-banners/${id}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('lms-uploads')
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false, cacheControl: '31536000' })
    if (upErr) {
      console.error('Course banner upload error:', upErr)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }
    const bannerUrl = supabase.storage.from('lms-uploads').getPublicUrl(path).data.publicUrl

    await (prisma.course.update as any)({ where: { id }, data: { bannerUrl } })

    logActivity({
      userId: session.userId, userName: session.name, userRole: session.role,
      actionType: ACTION.COURSE_UPDATED,
      actionDescription: `${session.name} changed the photo of course "${course.name}"`,
      moduleName: MODULE.COURSES, targetId: id,
    })
    return NextResponse.json({ bannerUrl })
  } catch (error) {
    console.error('Error uploading course banner:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Reset to the default illustration.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard()
    if (g.error) return g.error
    const session = g.session!
    await ensureCourseColumns()
    const { id } = await params
    const course = await prisma.course.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    await (prisma.course.update as any)({ where: { id }, data: { bannerUrl: null } })
    logActivity({
      userId: session.userId, userName: session.name, userRole: session.role,
      actionType: ACTION.COURSE_UPDATED,
      actionDescription: `${session.name} reset the photo of course "${course.name}"`,
      moduleName: MODULE.COURSES, targetId: id,
    })
    return NextResponse.json({ bannerUrl: null })
  } catch (error) {
    console.error('Error resetting course banner:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
