'use client'

import Script from 'next/script'

export default function GoogleAnalytics({ gaId }: { gaId?: string }) {
  const measurementId = gaId || process.env.NEXT_PUBLIC_GA_ID

  if (!measurementId) return null

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
              send_page_view: true
            });
            // Auto tag platform as 'app' or 'web'
            try {
              if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
                gtag('set', 'user_properties', { platform: 'app' });
              } else {
                gtag('set', 'user_properties', { platform: 'web' });
              }
            } catch (e) {}
          `,
        }}
      />
    </>
  )
}
