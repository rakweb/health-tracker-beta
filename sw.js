/* sw.js */
'use strict';

const CACHE_PREFIX = 'health-tracker';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './range-slider.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './version.json',
  // './offline.html' // if you add one
];

// Cache name can be updated from version.json at install time.
// Fallback to timestamp-based cache if fetch fails.
let CACHE_NAME = `${CACHE_PREFIX}-v${Date.now()}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const res = await fetch('./version.json', { cache: 'no-store' });
      if (res.ok) {
        const v = await res.json();
        const build = v.build || v.version || Date.now();
        CACHE_NAME = `${CACHE_PREFIX}-v${build}`;
      }
    } catch { /* ignore */ }

    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    // Don’t auto-activate here; let the page decide via toast + SKIP_WAITING
    // self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean old caches
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith(CACHE_PREFIX + '-') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );

    await self.clients.claim();
  })());
});

// Messaging support: SKIP_WAITING and GET_VERSION
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (msg.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', cache: CACHE_NAME });
  }
});

// Fetch strategies
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation: Network-first (fresh HTML), fallback to cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match('./index.html');
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // version.json: always network
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Static assets: cache-first, revalidate in background
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, res.clone());
    return res;
  })());
});
