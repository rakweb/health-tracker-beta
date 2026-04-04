// build-marker: v1.0.40+40 (2026-04-02T22:36:50Z)
// Simple offline-first service worker for Health Tracker
const CACHE_NAME = 'health-tracker-beta';
const CACHE = 'health-tracker-vX'; // increase this number
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME && caches.delete(key))
    )).then(() => self.clients.claim())
  );
});


self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request));
    return;
  }
});
``
  // Cache-first for same-origin GET static assets
  if (req.method === 'GET' && new URL(req.url).origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        return res;
      }))
    );
 };
