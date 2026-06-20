/* ============================================================================
 * Shiftia Service Worker
 * Estrategia: stale-while-revalidate REAL para assets estáticos + offline fallback.
 * Excluye /api/*, /dashboard y métodos no-GET (siempre van a red).
 * ============================================================================ */
const CACHE_NAME = 'shiftia-v4.2';
const PRECACHE = [
  '/',
  '/design-system.css',
  '/v36.css?v=362',
  '/v36.min.js?v=382',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/og-image.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/site.webmanifest',
  '/404.html',
  '/500.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/dashboard')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      // Background revalidate — keeps the cache fresh for the NEXT visit.
      const networkPromise = fetch(req).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(req, response.clone()).catch(() => {});
        }
        return response;
      }).catch(() => null);

      // True SWR: if we have a cached response, serve it immediately AND let the
      // network promise run in the background. Otherwise wait for the network
      // and fall back to the offline page only if both miss.
      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }
      const fresh = await networkPromise;
      return fresh || (await cache.match('/404.html'));
    })
  );
});
