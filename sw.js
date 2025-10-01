const CACHE_NAME = 'financeiro-pwa-v5'; // Incremented version to force update
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json',
  // URLs from importmap in index.html
  'https://aistudiocdn.com/react@^19.1.1',
  'https://aistudiocdn.com/react-dom@^19.1.1/client',
  'https://aistudiocdn.com/framer-motion@^12.23.12',
  'https://aistudiocdn.com/@supabase/supabase-js@^2.57.0',
  'https://aistudiocdn.com/recharts@^3.1.2',
  'https://aistudiocdn.com/@google/genai@^1.17.0',
  // Other assets
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(error => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Identify API calls. These should be network-first.
  const isApiCall = url.hostname.includes('supabase.co') || url.hostname.includes('teuco.com.br');
  
  // For navigation requests, use network first to get the latest HTML
  const isNavigation = event.request.mode === 'navigate';
  
  if (isNavigation) {
      event.respondWith(
          fetch(event.request)
              .catch(() => caches.match('/index.html'))
      );
      return;
  }

  if (isApiCall) {
    // Network-first strategy for API calls
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // If successful, clone the response, cache it, and return it.
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If network fails, try to get the response from the cache.
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // IMPORTANT: If not in cache, we MUST return a valid Response object.
            // Returning undefined causes a TypeError.
            // We create a synthetic error response that the client-side code can handle.
            const errorBody = { message: 'Você está offline e os dados não estão disponíveis no cache.' };
            return new Response(JSON.stringify(errorBody), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'application/json' })
            });
          });
        })
    );
  } else {
    // Cache-first strategy for static assets (JS, CSS, fonts, etc.)
    event.respondWith(
      caches.match(event.request).then(response => {
        // Return from cache if found.
        if (response) {
          return response;
        }

        // Not in cache, fetch from network
        return fetch(event.request).then(networkResponse => {
          // Cache the new response for future use.
          if (networkResponse && networkResponse.ok && networkResponse.type !== 'opaque') {
             const responseToCache = networkResponse.clone();
             caches.open(CACHE_NAME).then(cache => {
               cache.put(event.request, responseToCache);
             });
          }
          return networkResponse;
        });
      })
    );
  }
});