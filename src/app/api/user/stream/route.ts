import { NextResponse } from 'next/server'
import { sseEmitter } from '@/lib/sse'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { userId, role } = session

    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false

        const pushEvent = (eventType: string, data: any) => {
          if (isClosed) return
          try {
            const packed = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
            controller.enqueue(new TextEncoder().encode(packed))
          } catch (e) {
            console.error('SSE enqueue error:', e)
          }
        }

        // Keep-alive ping every 15 seconds to prevent timeout
        const interval = setInterval(() => {
          if (isClosed) return
          try {
            controller.enqueue(new TextEncoder().encode(': keepalive\n\n'))
          } catch (e) {
            console.error('SSE keep-alive error:', e)
            clearInterval(interval)
          }
        }, 15000)

        // Event listeners
        // 1. Listen for global targeted notifications
        const handleUserNotification = () => pushEvent('invalidate', { target: 'notifications' })
        
        // 2. Listen for global unread updates
        const handleUserUnread = () => pushEvent('invalidate', { target: 'unread' })

        // 3. System-wide broadcasts
        const handleSystemNotify = () => pushEvent('invalidate', { target: 'all' })

        // Attach listeners
        sseEmitter.on(`user:${userId}:notify`, handleUserNotification)
        sseEmitter.on(`user:${userId}:unread`, handleUserUnread)
        sseEmitter.on('system:notify', handleSystemNotify)

        if (role === 'MANAGER' || (role === 'ADMIN' || role === 'MODERATOR')) {
           // Managers also need to know when a support ticket or support live-chat changes state
           sseEmitter.on('system:admin_unread', handleUserUnread)
        }

        req.signal.addEventListener('abort', () => {
          isClosed = true
          clearInterval(interval)
          sseEmitter.off(`user:${userId}:notify`, handleUserNotification)
          sseEmitter.off(`user:${userId}:unread`, handleUserUnread)
          sseEmitter.off('system:notify', handleSystemNotify)
          sseEmitter.off('system:admin_unread', handleUserUnread)
          try {
            controller.close()
          } catch (e) {}
        })
      }
    })

    return new NextResponse(stream, { headers })
  } catch (error) {
    console.error('SSE stream error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
