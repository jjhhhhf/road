/* Minimal service worker to make the app installable.
 * Cache strategy: navigation -> cache-first (fallback to start page), assets -> stale-while-revalidate.
 */

const CACHE_NAME = 'lukou-pailei-v2';

const START_PAGE = './%E8%B7%AF%E5%8F%A3%E6%8E%92%E9%9B%B7_%E5%AE%8C%E6%95%B4%E7%89%88App.html';

const CORE_ASSETS = [
  './',
  './manifest.webmanifest',
  './icon.svg',
  START_PAGE,
  // External assets (best-effort). These may be opaque responses and can fail depending on network.
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    const results = await Promise.allSettled(
      CORE_ASSETS.map(async (url) => {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          // Cache ok, opaque, and basic responses.
          if (response && (response.ok || response.type === 'opaque')) {
            await cache.put(url, response);
          }
        } catch {
          // Best-effort: ignore individual failures.
        }
      })
    );

    // Keep eslint/linters from complaining about unused
    void results;

    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache API or uploaded photos; always hit the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // For navigation, prefer network so HTML updates are visible.
    if (isNavigationRequest(request)) {
      try {
        const net = await fetch(request, { cache: 'no-cache' });
        if (net && net.ok) {
          // Always refresh the cached start page for offline.
          await cache.put(START_PAGE, net.clone());
        }
        return net;
      } catch {
        const cachedStart = await cache.match(START_PAGE);
        if (cachedStart) return cachedStart;
        throw new Error('Offline');
      }
    }

    // Assets: stale-while-revalidate
    const cached = await cache.match(request);
    const fetchPromise = (async () => {
      try {
        const net = await fetch(request);
        if (net && (net.ok || net.type === 'opaque')) {
          await cache.put(request, net.clone());
        }
        return net;
      } catch {
        return cached;
      }
    })();

    return cached || fetchPromise;
  })());
});
