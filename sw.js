// Service Worker for Weather App

const CACHE_NAME = 'variable-weather-cache';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/main.js',
  '/js/api.js',
  '/js/apiSettings.js',
  '/js/ui.js',
  '/js/utils.js',
  '/js/units.js',
  '/js/config.js',
  '/js/weatherIcons.js',
  '/js/weatherBackgrounds.js',
  // Add fonts, images, and other assets as needed
  '/resources/bootstrap/css/bootstrap.min.css',
  '/resources/font-awesome/all.min.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon-32x32.png'
];

// Install event - cache the app shell
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {

  // API requests - network first, then cache, with timeout
  if (event.request.url.includes('api.weather.gov') ||
    event.request.url.includes('api.pirateweather.net') ||
    event.request.url.includes('nominatim.openstreetmap.org')) {
    // For API requests, use a network-first strategy with timeout
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(caches.match('/offline.html'));
      }, 3000); // 3-second timeout
    });

    const networkPromise = fetch(event.request)
      .then(response => {
        // Cache a copy of the response
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try from cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If nothing in cache, show offline page
            return caches.match('/offline.html');
          });
      });

    event.respondWith(Promise.race([networkPromise, timeoutPromise]));
    return;
  }

  // For static assets (app shell), use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache the newly fetched resource
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(error => {
            console.error('[Service Worker] Fetch failed:', error);
            // For navigation requests, show the offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            // For images, return a placeholder
            if (event.request.destination === 'image') {
              return caches.match('/icons/icon-512x512.png');
            }
            // For everything else, just fail
            return new Response('Network error', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});