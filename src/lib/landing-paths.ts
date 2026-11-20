// Public storefront landing site paths. Shared by middleware and the root layout.
export const LANDING_PATHS = ['/about', '/contact', '/blog', '/docs', '/careers', '/one-to-one', '/1-on-1', '/ecosystem', '/explore', '/syllabus', '/resources', '/tools', '/access-pdf', '/newsletter', '/knowledge', '/cart', '/checkout', '/refer', '/terms', '/privacy', '/refund', '/payment-success', '/payment-failed', '/verify', '/employee', '/graded-assignment']

// pSEO pages are served by the landing catch-all at root URLs. Only these slug shapes are public
// (from the storefront pSEO slug rules), so unknown URLs still go through the normal login check.
const PSEO_PREFIXES = ['/glossary/', '/compare/', '/guide/', '/careers-after-iitm-bs/']
const PSEO_ROOT = /^\/iitm-bs[a-z0-9-]*$/

export function isLandingPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (LANDING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return true
  return PSEO_PREFIXES.some(p => pathname.startsWith(p)) || PSEO_ROOT.test(pathname)
}
