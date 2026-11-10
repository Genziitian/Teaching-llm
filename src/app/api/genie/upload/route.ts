import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { MAX_IMAGE_BYTES } from '@/lib/genie/limits'

const MAX_PER_DAY = 30

function sniff(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp'
  return null
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'STUDENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const since = new Date(); since.setHours(0, 0, 0, 0)
    const [a, b] = await Promise.all([
      prisma.chatMessage.count({ where: { senderId: me.userId, imageUrl: { not: null }, createdAt: { gte: since } } }),
      prisma.ticketReply.count({ where: { senderId: me.userId, imageUrl: { not: null }, createdAt: { gte: since } } }),
    ])
    if (a + b >= MAX_PER_DAY) return NextResponse.json({ error: 'Daily photo limit reached' }, { status: 429 })

    const file = (await req.formData()).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Photo is too large (max 5 MB)' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const kind = sniff(buf)
    if (!kind) return NextResponse.json({ error: 'Only JPG, PNG or WEBP photos are allowed' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Storage is not configured')
    const supabase = createClient(url, key)
    const path = `genie-files/${crypto.randomUUID()}.${kind}`
    const { error } = await supabase.storage.from('lms-uploads').upload(path, buf, {
      contentType: kind === 'jpg' ? 'image/jpeg' : `image/${kind}`, upsert: false,
    })
    if (error) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    return NextResponse.json({ url: supabase.storage.from('lms-uploads').getPublicUrl(path).data.publicUrl })
  } catch (e) {
    console.error('genie upload', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
