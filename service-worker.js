const CACHE_NAME = 'health-tracker-v1';
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => 
      cache.addAll(['/', 'index.html', 'styles.css', 'chart.js'])
    )
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(response => response || fetch(e.request)));
});