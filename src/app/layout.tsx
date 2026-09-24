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

/**
 * Capacitor injects window.Capacitor at the start of <head>, before this script.
 * The React banner cannot paint until the client bundle hydrates, which on a
 * phone can take long enough for someone to use the app. This overlay blocks
 * the shell immediately. Web and PWA have no native Capacitor bridge here.
 */
const PLAY_SUNSET_SCRIPT = `
(function(){
  try {
    window.__openOfficialPlayApp = function() {
      try {
        if (window.GenZPlayInline && typeof window.GenZPlayInline.openOfficialApp === 'function') {
          window.GenZPlayInline.openOfficialApp();
          return;
        }
      } catch (e) {}
      var ref = encodeURIComponent('utm_source=capacitor&utm_medium=sunset_banner');
      var market = 'market://details?id=com.teaching.lms&referrer=' + ref;
      var httpsUrl = 'https://play.google.com/store/apps/details?id=com.teaching.lms&referrer=' + ref;
      var cap = window.Capacitor;
      var native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
      window.location.href = native ? market : httpsUrl;
    };

    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
    if (document.getElementById('cap-play-sunset')) return;

    var root = document.documentElement;
    root.style.overflow = 'hidden';
    var overlay = document.createElement('div');
    overlay.id = 'cap-play-sunset';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;background:#fff;color:#1e1e3a;font-family:system-ui,-apple-system,sans-serif;text-align:center;';
    overlay.innerHTML = '<img src="/mobile-login-logo.png" alt="GenZ IITIAN" style="width:148px;height:auto;margin-bottom:28px">'
      + '<p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#01875f">Google Play Store</p>'
      + '<h1 style="margin:0;max-width:420px;font-size:26px;line-height:1.25;font-weight:800">We are very proud to announce that our official app is now live on the Google Play Store.</h1>'
      + '<p style="margin:18px 0 0;max-width:380px;font-size:16px;line-height:1.5;color:#4b5563">We are closing this app. Please click the button to download the app.</p>';
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Download the app';
    button.style.cssText = 'margin-top:32px;min-width:260px;min-height:56px;padding:0 22px;border:none;border-radius:14px;background:#111;color:#fff;font-size:16px;font-weight:700;';
    button.addEventListener('click', function() { window.__openOfficialPlayApp(); });
    overlay.appendChild(button);
    root.appendChild(overlay);
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
        <script dangerouslySetInnerHTML={{ __html: PLAY_SUNSET_SCRIPT }} />
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
