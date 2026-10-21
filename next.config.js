const defaultRuntimeCaching = require('next-pwa/cache')

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'worker',
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    {
      urlPattern: /\/pdf\.worker\.min\.mjs$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'pdf-worker-cache',
        expiration: {
          maxEntries: 1,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        const path = url.pathname
        return path === '/dashboard' || path === '/downloads' || path.startsWith('/dashboard/') || path.startsWith('/downloads/')
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'app-shell-routes',
        networkTimeoutSeconds: 4,
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    {
      urlPattern: /\/api\/auth\/me/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'auth-me',
        expiration: {
          maxEntries: 1,
          maxAgeSeconds: 86400, // 24 hours
        },
      },
    },
    ...defaultRuntimeCaching,
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    domains: ['localhost'],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/worker-:path*.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/fallback-:path*.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/workbox-:path*.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // Prevent clickjacking — only allow your own site to iframe the app
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information sent with requests
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Opt-out of Google FLoC/Topics tracking
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // CORS: Only allow same-origin API access (block other websites)
        source: '/api/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Requested-With, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ]
  },
}

const { withSentryConfig } = require('@sentry/nextjs/config')

module.exports = withSentryConfig(
  withPWA(nextConfig),
  {
    silent: true,
    org: 'teaching-lms',
    project: 'teaching-llm',
    // Disable heavy sourcemap generation and upload to prevent Node.js Out-Of-Memory on 2GB VPS
    sourcemaps: {
      disable: true,
    },
    telemetry: false,
  }
)

