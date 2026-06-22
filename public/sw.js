const CACHE_NAME = 'lukou-pailei-v5';
const API_CACHE  = 'lukou-api-v5';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/css/app.css',
  '/js/config.js',
  '/js/api.js',
  '/js/map.js',
  '/js/community.js',
  '/js/achievements.js',
  '/js/profile.js',
  '/js/app.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(
      CORE_ASSETS.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res && (res.ok || res.type === 'opaque')) await cache.put(url, res);
        } catch { /* best-effort */ }
      })
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => k !== CACHE_NAME && k !== API_CACHE && caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API: stale-while-revalidate（離線時回傳快取）
  if (url.pathname === '/api/state' || url.pathname === '/api/hazards/categories') {
    event.respondWith((async () => {
      const cache  = await caches.open(API_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request).then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await networkPromise) || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    })());
    return;
  }

  // 上傳資料直接走網路
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 靜態資源：cache-first，背景更新
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const networkFetch = fetch(request).then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || networkFetch;
  })());
});
