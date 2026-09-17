import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { checkRateLimit, isMaintenanceModeActive } from '@/lib/ratelimit'
import { canBypassMaintenance } from '@/lib/maintenance-access'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/terminated', '/api/maintenance-status', '/api/external-enroll', '/api/analytics/compute', '/api/app-version', '/download']
const COOKIE_NAME = 'teaching_llm_token'
const JWT_SECRET = process.env.JWT_SECRET?.trim() || ''

// Methods that modify data — these get CSRF + rate limit checks
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

// API routes exempt from CSRF header check (called by external services or browser forms)
const CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/logout',
  '/api/sync-queue', // cron job — has its own auth via CRON_SECRET
  '/api/external-enroll', // external purchase system — has its own auth via EXTERNAL_ENROLL_SECRET
  '/api/analytics/compute', // analytics cron job — has its own auth via CRON_SECRET
]

/**
 * Extracts session token from cookie or Authorization Bearer header
 */
function getSessionToken(request: NextRequest): string | undefined {
  const cookieVal = request.cookies.get(COOKIE_NAME)?.value
  if (cookieVal) return cookieVal
  
  const authHeader = request.headers.get('Authorization') ?? request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Also check query param token for drive-stream requests
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api/drive-stream/')) {
    const queryToken = request.nextUrl.searchParams.get('token')
    if (queryToken) return queryToken
  }

  return undefined
}

/**
 * Redirects to the login page, preserving the current request path and search query in a 'next' query param.
 */
function getLoginRedirectResponse(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', pathname + search)
  return NextResponse.redirect(loginUrl)
}

async function getMaintenanceModeState(request: NextRequest): Promise<{ active: boolean }> {
  try {
    // 1. Check Redis directly (super-fast, zero loopback HTTP calls)
    const redisActive = await isMaintenanceModeActive()
    if (redisActive) return { active: true }

    // 2. Loopback to local port via HTTP to avoid ERR_SSL_WRONG_VERSION_NUMBER on Render
    const port = process.env.PORT || '10000'
    const statusUrl = `http://127.0.0.1:${port}/api/maintenance-status`
    const response = await fetch(statusUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return { active: false }

    const data = await response.json()
    return { active: data?.active === true }
  } catch (error) {
    return { active: false }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Always allow static assets from /public and built asset paths.
  if (pathname.startsWith('/_next/') || /\.(.*)$/.test(pathname)) {
    return NextResponse.next()
  }

  // ─── 1. Rate Limiting for Login ───
  if (pathname === '/api/auth/login' && method === 'POST') {
    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success, reset } = await checkRateLimit(`login_${ip}`, 'login')
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          }
        }
      )
    }
  }

  // ─── 2. Rate Limiting for ALL Write Operations ───
  if (pathname.startsWith('/api/') && WRITE_METHODS.includes(method) && !pathname.startsWith('/api/auth/')) {
    const token = getSessionToken(request)
    // Rate limit by user (via JWT userId) or by IP for unauthenticated requests
    let rateLimitKey = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    
    if (token && JWT_SECRET) {
      try {
        const secret = new TextEncoder().encode(JWT_SECRET)
        const { payload } = await jwtVerify(token, secret)
        if (payload.userId) {
          rateLimitKey = payload.userId as string
        }
      } catch {}
    }

    const { success } = await checkRateLimit(`write_${rateLimitKey}`, 'general')
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 }
      )
    }
  }

  // ─── 3. CSRF Protection for Write API Calls ───
  if (
    pathname.startsWith('/api/') &&
    WRITE_METHODS.includes(method) &&
    !CSRF_EXEMPT_PATHS.some(p => pathname.startsWith(p))
  ) {
    // Only check CSRF if auth is cookie-based. If Bearer token is used in Authorization, it's immune to CSRF.
    const authHeader = request.headers.get('Authorization') ?? request.headers.get('authorization')
    const isBearerAuth = authHeader?.startsWith('Bearer ')

    if (!isBearerAuth) {
      const xRequestedWith = request.headers.get('x-requested-with')
      // Browsers block cross-origin JavaScript from setting custom headers,
      // so requiring this header prevents CSRF attacks from other websites
      if (xRequestedWith !== 'XMLHttpRequest') {
        return NextResponse.json(
          { error: 'Forbidden — missing required header' },
          { status: 403 }
        )
      }
    }
  }

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ─── 4. Global Maintenance Mode Check ───
  const { active: isMaintenance } = await getMaintenanceModeState(request)
  
  if (isMaintenance) {
    const isEssential = pathname.startsWith('/api/auth') ||
                       pathname.startsWith('/api/support') ||
                       pathname === '/api/maintenance-status' ||
                       pathname.startsWith('/_next/') ||
                       pathname === '/maintenance' ||
                       pathname === '/maintenance-illustration.jpg' ||
                       /\.(.*)$/.test(pathname)
 
    if (!isEssential) {
      const token = getSessionToken(request)
      if (token && JWT_SECRET) {
        try {
          const secret = new TextEncoder().encode(JWT_SECRET)
          const { payload } = await jwtVerify(token, secret)
          if (canBypassMaintenance(payload.role)) {
            return NextResponse.next()
          }
        } catch (e) {}
      }
      
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'System is under maintenance' }, { status: 503 })
      }
      return NextResponse.redirect(new URL('/maintenance', request.url))
    }

    // Allow public rendering of the maintenance page under maintenance
    if (pathname === '/maintenance') {
      return NextResponse.next()
    }
  } else if (pathname === '/maintenance') {
    // If not in maintenance mode, redirect away from the maintenance page
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Allow API auth routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Root redirect
  if (pathname === '/') {
    const token = getSessionToken(request)
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Check for auth cookie/header
  const token = getSessionToken(request)

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return getLoginRedirectResponse(request)
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set — cannot verify tokens')
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return getLoginRedirectResponse(request)
  }

  try {
    // Full JWT signature verification at the Edge
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    // Role-based route protection
    if (pathname.startsWith('/admin') && (payload.role === 'STUDENT' || payload.role === 'INSTRUCTOR')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname.startsWith('/manage') && payload.role === 'STUDENT') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname.startsWith('/chat-transcripts') && payload.role !== 'MANAGER') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname.startsWith('/work-log') && payload.role !== 'MANAGER') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // Only managers can access study materials
    if (pathname.startsWith('/materials') && payload.role !== 'MANAGER') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } catch (error) {
    console.error('JWT Verification failed in middleware:', error)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const response = getLoginRedirectResponse(request)
    response.cookies.delete(COOKIE_NAME)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
    '/api/community/:path*',
    '/api/courses/:path*',
  ],
}
