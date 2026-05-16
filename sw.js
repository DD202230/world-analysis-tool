const CACHE_NAME = 'yiyin-v4-5-14';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/animations.js',
  '/manifest.json',
  '/data/guaData.js',
  '/data/pratityaData.js',
  '/data/praxisData.js',
  '/data/contradictionData.js',
  '/data/phenomenologyData.js',
  '/data/stoicData.js'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate strategy for assets, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (API calls, etc.) — let browser handle them
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache first, then network fallback + cache update
  if (STATIC_ASSETS.includes(url.pathname) || request.destination === 'style' || request.destination === 'script' || request.destination === 'document') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Fonts and other resources: network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Background sync for offline analysis queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'yiyin-sync') {
    event.waitUntil(syncPendingAnalyses());
  }
});

async function syncPendingAnalyses() {
  // Placeholder for future offline queue sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}
