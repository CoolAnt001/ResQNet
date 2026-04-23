const CACHE_NAME = 'resqnet-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// PASS-THROUGH strategy for live sync data
self.addEventListener('fetch', (event) => {
  // If it's a mesh/sync request, bypass cache entirely
  if (event.request.url.includes('/node_count') || event.request.url.includes('/list_intel')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});