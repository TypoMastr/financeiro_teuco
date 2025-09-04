const CACHE_NAME = 'financeiro-pwa-v2'; // Incremented version to force update
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  "https://esm.sh/react@18.2.0",
  "https://esm.sh/react-dom@18.2.0/client",
  "https://esm.sh/framer-motion@11.3.11?external=react",
  "https://esm.sh/recharts@2.12.7?external=react",
  "https://esm.sh/@google/genai",
  "https://esm.sh/@supabase/supabase-js@2", // Added Supabase client
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Clone the request to use it for both cache and network
        const fetchRequest = event.request.clone();
        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clone the response to use it for both browser and cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// New listeners for push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');
  let data = { title: 'Nova Notificação', body: 'Algo novo aconteceu!' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Push event data parsing error:', e);
  }

  const options = {
    body: data.body,
    icon: '/icon512_rounded.png',
    badge: '/icon512_rounded.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});