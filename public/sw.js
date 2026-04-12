const CACHE_NAME = 'gestureflow-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete all old caches (including the stale v1 cache)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Web Push ──────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() }; }

  const title   = data.title ?? 'GestureFlow';
  const options = {
    body:     data.body  ?? 'Time to check in!',
    icon:     '/icons/icon-192.png',
    badge:    '/icons/icon-192.png',
    tag:      data.tag   ?? 'gestureflow',
    renotify: true,
    data:     { url: data.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate ? c.navigate(target) : null;
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip: non-GET, cross-origin, API routes, and Next.js bundles.
  // Next.js already serves /_next/static/ with immutable Cache-Control headers
  // so the browser handles that caching correctly without SW interference.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/')
  ) {
    return;
  }

  // Network-first for everything else (manifests, icons, pages).
  // Falls back to cache only when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
