/* ============================================================================
 * Shiftia Service Worker · v1
 * Estrategia: stale-while-revalidate para assets estáticos + offline fallback.
 * Excluye /api/* y POSTs (siempre van a red).
 * ============================================================================ */
const CACHE_NAME = 'shiftia-v3.6';
const PRECACHE = [
  '/',
  '/design-system.css',
  '/v36.css?v=362',
  '/v36.js?v=362',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/og-image.svg',
  '/product-mockup.svg',
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
  // Las APIs nunca pasan por el SW
  if (url.pathname.startsWith('/api/')) return;
  // Stripe webhook / dashboard — no cachear nada con auth
  if (url.pathname.startsWith('/dashboard')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(req, response.clone()).catch(() => {});
        }
        return response;
      }).catch(() => cached || cache.match('/404.html'));
      return cached || fetchPromise;
    })
  );
});
