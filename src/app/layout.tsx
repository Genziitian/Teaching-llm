import type { Metadata, Viewport } from 'next'
import './globals.css'
import 'katex/dist/katex.min.css'
import CsrfProvider from '@/components/CsrfProvider'
import MobileBlocker from '@/components/layout/MobileBlocker'
import CapacitorBridge from '@/components/CapacitorBridge'
import CapacitorPlayStoreBanner from '@/components/CapacitorPlayStoreBanner'
import AppUpdater from '@/components/AppUpdater'
import SplashOverlay from '@/components/SplashOverlay'
import { PostHogProvider } from '@/components/PostHogProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

/**
 * Anti-FOUC theme bootstrap. Runs synchronously in <head> BEFORE first paint so
 * the correct light/dark palette is applied with no flash — critical for the
 * Capacitor app on cold boot. Mirrors the logic in ThemeProvider.
 */
const THEME_INIT_SCRIPT = `
(function(){
  try {
    var c = localStorage.getItem('theme');
    var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var r = (c === 'dark' || c === 'light') ? c : sys;
    var d = document.documentElement;
    d.setAttribute('data-theme', r);
    d.style.colorScheme = r;
    var col = r === 'dark' ? '#161a23' : '#e8eaf0';
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name','theme-color'); document.head.appendChild(m); }
    m.setAttribute('content', col);
  } catch (e) {}
})();
`

const SW_CLEANUP_SCRIPT = `
(function(){
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        for (var i = 0; i < regs.length; i++) {
          regs[i].unregister().then(function(success) {
            if (success) window.location.reload();
          });
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) {
          caches.delete(key);
        });
      });
    }
  } catch (e) {}
})();
`

export const metadata: Metadata = {
  title: 'GenZ IITIAN',
  description: 'Upgrade How You Learn',
  manifest: '/site.webmanifest',
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

import SWRProvider from '@/components/SWRProvider'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import MicrosoftClarity from '@/components/MicrosoftClarity'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {process.env.NODE_ENV === 'development' && (
          <script dangerouslySetInnerHTML={{ __html: SW_CLEANUP_SCRIPT }} />
        )}
      </head>
      <body>
        <GoogleAnalytics />
        <MicrosoftClarity />
        <PostHogProvider>
          <SWRProvider>
            <ThemeProvider>
              <MobileBlocker />
              <CapacitorBridge />
              <AppUpdater />
              <SplashOverlay />
              <CapacitorPlayStoreBanner />
              <ServiceWorkerRegister />
              <CsrfProvider>{children}</CsrfProvider>
            </ThemeProvider>
          </SWRProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
