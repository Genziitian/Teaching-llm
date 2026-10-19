// GENz IITian LMS — Service Worker (Push Notifications & Offline Engine)
// This file is merged into the main PWA service worker by next-pwa.

const CACHE_NAME = 'genz-offline-shell-v2';
const PRECACHE_URLS = [
  '/offline.html',
  '/favicon.ico',
  '/logo.png',
  '/dashboard',
  '/downloads',
];

// 1. INSTALL: Precache critical offline fallback assets
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function (err) {
        console.warn('Precache non-blocking notice:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Claim clients immediately and clean old caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME && key.startsWith('genz-offline-')) {
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 3. FETCH: Intercept navigations & offline assets so browser never shows dinosaur
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Intercept Navigation requests (address bar, reload, client navigation)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseClone);
              // Also store under clean path without query params
              cache.put(url.pathname, responseClone.clone());
            });
          }
          return response;
        })
        .catch(async function () {
          // Device is offline!
          // A. Try exact URL match from cache (ignoring search queries like ?_rsc=...)
          const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
          if (cachedResponse) {
            return cachedResponse;
          }

          // B. Match /downloads or /dashboard routes
          if (url.pathname.includes('/downloads')) {
            const cachedDownloads = await caches.match('/downloads', { ignoreSearch: true });
            if (cachedDownloads) return cachedDownloads;
          }
          if (url.pathname.includes('/dashboard')) {
            const cachedDash = await caches.match('/dashboard', { ignoreSearch: true });
            if (cachedDash) return cachedDash;
          }

          // C. Check all open cache storages
          const keys = await caches.keys();
          for (const k of keys) {
            const cache = await caches.open(k);
            const match = await cache.match(url.pathname, { ignoreSearch: true });
            if (match) return match;
          }

          // D. Return styled offline fallback page
          const offlinePage = await caches.match('/offline.html', { ignoreSearch: true });
          if (offlinePage) {
            return offlinePage;
          }

          return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline - GenZ IITIAN</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0b0f19;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;"><div style="background:#161c2d;border:1px solid rgba(255,255,255,0.1);padding:32px;border-radius:20px;max-width:400px;"><h2 style="margin:0 0 12px;font-size:20px;">You are Offline</h2><p style="color:#94a3b8;font-size:14px;line-height:1.5;margin:0 0 20px;">Your downloaded notes are available in the Downloads section.</p><a href="/downloads" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px;font-size:14px;">Go to Downloads</a></div></body></html>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

});

// 4. PUSH NOTIFICATIONS
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'New Announcement', body: event.data.text() };
  }

  const title = data.title || 'GENz IITian';
  const options = {
    body: data.body || 'You have a new announcement.',
    icon: data.icon || '/android-chrome-192x192.png',
    badge: data.badge || '/favicon-32x32.png',
    tag: data.tag || 'announcement',
    image: data.imageUrl || data.image || null,
    actions: data.ctaText ? [{ action: 'cta', title: data.ctaText }] : [],
    data: { url: data.ctaLink || data.url || '/announcements' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. NOTIFICATION CLICK
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/announcements';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
