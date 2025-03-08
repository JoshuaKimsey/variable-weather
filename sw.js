// Service Worker for Weather App with update support

// App version - keep this in sync with the main app version
const SW_VERSION = '1.2.0';
const CACHE_NAME = `variable-weather-cache-v${SW_VERSION}`;

const ASSETS = [
  '/variable-weather/',
  '/variable-weather/index.html',
  '/variable-weather/styles.css',
  '/variable-weather/js/main.js',
  '/variable-weather/js/api.js',
  '/variable-weather/js/apiSettings.js',
  '/variable-weather/js/ui.js',
  '/variable-weather/js/utils.js',
  '/variable-weather/js/units.js',
  '/variable-weather/js/config.js',
  '/variable-weather/js/weatherIcons.js',
  '/variable-weather/js/weatherBackgrounds.js',
  '/variable-weather/js/pwaUpdates.js',
  '/variable-weather/js/radarView.js',
  // Add fonts, images, and other assets as needed
  '/variable-weather/resources/bootstrap/css/bootstrap.min.css',
  '/variable-weather/resources/font-awesome/all.min.css',
  '/variable-weather/icons/icon-192x192.png',
  '/variable-weather/icons/icon-512x512.png',
  '/variable-weather/icons/favicon-32x32.png'
];

// Install event - cache the app shell
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing new version:', SW_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        // Skip waiting is commented out to allow the user to control updates
        // return self.skipWaiting();
        console.log('[Service Worker] Installed and waiting for activation');
      })
  );
  
  // Notify clients about the new version
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'VERSION_CHANGE',
        version: SW_VERSION
      });
    });
  });
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating new version:', SW_VERSION);
  
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
      console.log('[Service Worker] Version', SW_VERSION, 'now active');
      return self.clients.claim();
    })
  );
});

// Listen for the skipWaiting message
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skip waiting and activate now');
    self.skipWaiting();
  }
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