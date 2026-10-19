const APP_ORIGIN = 'https://class.genziitian.in'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.teaching.lms'

/** A user-tapped Android link with an explicit Play Store fallback. */
export function androidAppIntent(location: string): string {
  let destination = new URL('/', APP_ORIGIN)
  try {
    const candidate = new URL(location, APP_ORIGIN)
    if (candidate.origin === APP_ORIGIN) destination = candidate
    if (destination.pathname === '/login') {
      const next = destination.searchParams.get('next')
      if (next?.startsWith('/') && !next.startsWith('//')) {
        const nextUrl = new URL(next, APP_ORIGIN)
        if (nextUrl.origin === APP_ORIGIN) destination = nextUrl
      }
    }
  } catch {
    // Invalid addresses open the app's home page.
  }
  // URI fragments delimit Intent fields, so pass only the path and query.
  return `intent://${destination.host}${destination.pathname}${destination.search}#Intent;scheme=https;package=com.teaching.lms;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`
}
