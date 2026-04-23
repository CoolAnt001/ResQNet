const CACHE_NAME = 'resqnet-tactical-v1';
const MAP_CACHE_NAME = 'resqnet-map-tiles';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;500;700;900&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// 1. Installation: Pre-cache core UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Fetch Strategy: Cache-First for Tiles, Stale-While-Revalidate for UI
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Tactical Map Caching: Intercept CartoDB tiles
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open(MAP_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          // Return cached tile if available
          if (response) return response;

          // Otherwise fetch and save to tactical cache
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  } else {
    // Standard UI Assets
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// 3. Activation: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== MAP_CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});