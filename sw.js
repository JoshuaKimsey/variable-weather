// Service Worker for Variable Weather with update support

// App version - keep this in sync with the main app version
const SW_VERSION = '2.3.0';
const CACHE_NAME = `variable-weather-cache-v${SW_VERSION}`;

/*
* Add new API url's here
*/
const API_URLs = [
  'api.weather.gov',
  'api.pirateweather.net',
  'api.open-meteo.com',
  'nominatim.openstreetmap.org'
]

/* 
* Add assets that should be cached here
*/
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  
  // CSS Files
  './styles/alerts.css',
  './styles/animations.css',
  './styles/astronomical.css',
  './styles/base-layout.css',
  './styles/modals.css',
  './styles/nowcast.css',
  './styles/radar.css',
  './styles/weather-displays.css',
  
  // Core files
  './js/main.js',
  './js/api.js',
  './js/config.js',
  './js/pwa.js',
  './js/pwaUpdates.js',
  './js/standardWeatherFormat.js',
  './sw.js',
  
  // UI core and components
  './js/ui/core.js',
  './js/ui/components/alertsDisplay.js',
  './js/ui/components/astronomical.js',
  './js/ui/components/currentWeather.js',
  './js/ui/components/forecasts.js',
  './js/ui/components/nowcast.js',
  './js/ui/components/radar.js',
  
  // UI controls
  './js/ui/controls/searchBar.js',
  './js/ui/controls/settings.js',
  
  // UI states
  './js/ui/states/errors.js',
  './js/ui/states/loading.js',
  
  // UI visuals
  './js/ui/visuals/dynamicIcons.js',
  './js/ui/visuals/dynamicBackgrounds.js',
  
  // Utils
  './js/utils/astroCalc.js',
  './js/utils/autoUpdate.js',
  './js/utils/cssLoader.js',
  './js/utils/formatting.js',
  './js/utils/geo.js',
  './js/utils/logger.js',
  './js/utils/time.js',
  './js/utils/units.js',
  
  // API modules
  './js/api/openMeteoApi.js',
  './js/api/pirateWeatherApi.js',

  // Alert API modules
  './js/api/alerts/alertsApi.js',
  './js/api/alerts/nwsAlerts.js',
  
  // Resources - keep only essential ones that are needed for offline functionality
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/favicon-32x32.png',
  './icons/social-thumbnail.png',
  './resources/bootstrap/css/bootstrap.min.css',
  './resources/bootstrap/icons/bootstrap-icons.min.css',
  './resources/bootstrap/icons/fonts/bootstrap-icons.woff',
  './resources/bootstrap/icons/fonts/bootstrap-icons.woff2',
  './resources/leaflet/leaflet.css',
  './resources/leaflet/leaflet.js',
  './resources/leaflet/images/layers-2x.png',
  './resources/leaflet/images/marker-icon-2x.png',
  './resources/leaflet/images/marker-shadow.png',
  './resources/leaflet/images/layers.png',
  './resources/leaflet/images/marker-icon.png',
  './resources/suncalc3/suncalc.js',
  './resources/tz-lookup/tz.js',

  // Weather icons - core forecast set
  './resources/meteocons/fill/clear-day.svg',
  './resources/meteocons/fill/partly-cloudy-day.svg',
  './resources/meteocons/fill/overcast-day.svg',
  './resources/meteocons/fill/cloudy.svg',
  './resources/meteocons/fill/wind.svg',
  './resources/meteocons/fill/snow.svg',
  './resources/meteocons/fill/rain.svg',
  './resources/meteocons/fill/thunderstorms-rain.svg',
  './resources/meteocons/fill/tornado.svg',
  './resources/meteocons/fill/hurricane.svg',
  './resources/meteocons/fill/dust.svg',
  './resources/meteocons/fill/smoke.svg',
  './resources/meteocons/fill/haze.svg',
  './resources/meteocons/fill/thermometer-warmer.svg',
  './resources/meteocons/fill/thermometer-colder.svg',
  './resources/meteocons/fill/fog.svg',
  './resources/meteocons/fill/sleet.svg',
  './resources/meteocons/fill/clear-night.svg',
  './resources/meteocons/fill/partly-cloudy-night.svg',
  './resources/meteocons/fill/overcast-night.svg',
  './resources/meteocons/fill/raindrops.svg',
  './resources/meteocons/fill/hail.svg',
  './resources/meteocons/fill/thunderstorms.svg',
  './resources/meteocons/fill/not-available.svg',

  // Alert hazard icons
  './resources/meteocons/fill/code-yellow.svg',
  './resources/meteocons/fill/lightning-bolt.svg',
  './resources/meteocons/fill/wind-alert.svg',
  './resources/meteocons/fill/wind-dust.svg',
  './resources/meteocons/fill/weather-alarm.svg',
  './resources/meteocons/fill/smoke-particles.svg',
  './resources/meteocons/fill/alert-avalanche-danger.svg',
  './resources/meteocons/fill/flag-storm-warning.svg',
  './resources/meteocons/fill/flag-small-craft-advisory.svg',
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

// Handle messages from the page
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skip waiting and activate now');
    self.skipWaiting();
    return;
  }

  // The page asks us for our version on init so it has a single source of truth.
  if (event.data.type === 'GET_VERSION') {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ version: SW_VERSION });
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Cache API only supports http(s); skip extension/data/blob schemes and non-GETs.
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return;

  for (let i = 0; i < API_URLs.length; i++) {
    if (event.request.url.includes(API_URLs[i])) {
      // For API requests, use a network-first strategy with timeout
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(caches.match('/offline.html'));
      }, 5000); // 5-second timeout
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
      .catch(async () => {
        // If network fails, try from cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.match('/offline.html');
      });

    event.respondWith(Promise.race([networkPromise, timeoutPromise]));
    return;
    }
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
