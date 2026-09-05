/**
 * uwi Service Worker (PWA Phase 1)
 * Provides static shell caching, offline startup capability, and update management.
 */

const CACHE_VERSION = 'uwi-v1.0.0';
const STATIC_CACHE_NAME = `uwi-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `uwi-dynamic-${CACHE_VERSION}`;

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg'
];

// URLs that must NEVER be cached by the service worker
const EXCLUDED_HOSTS_AND_PATHS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebaseappcheck.googleapis.com',
  'google-analytics.com',
  'recaptcha.net',
  'google.com/recaptcha',
  'gstatic.com/recaptcha',
  '/api/'
];

// Helper to determine if a request should bypass the SW cache entirely
function shouldBypassCache(url) {
  return EXCLUDED_HOSTS_AND_PATHS.some((pattern) => url.href.includes(pattern));
}

// 1. INSTALL
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (err) {
        console.warn('[SW] Pre-cache partial warning:', err);
      }
    })
  );
  // Do not automatically force skipWaiting so the user can choose to click [Actualizar] when prompt appears
});

// 2. ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME && key.startsWith('mm-')) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH STRATEGY
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Strictly bypass sensitive Firestore, Firebase Auth, AppCheck, and API calls
  if (shouldBypassCache(url)) {
    return;
  }

  // A. Navigation requests (HTML documents, SPA routing like /pedido/:token or /)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, serve cached navigation response or fallback to cached /index.html
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallbackIndex = await caches.match('/index.html');
          if (fallbackIndex) return fallbackIndex;
          const rootIndex = await caches.match('/');
          return rootIndex || Response.error();
        })
    );
    return;
  }

  // B. Static Assets (JS, CSS, images, SVGs, web fonts, icons)
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
     url.pathname.startsWith('/icons/') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.svg') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.ico') ||
     url.pathname.endsWith('.woff2') ||
     url.pathname.endsWith('.woff') ||
     url.pathname.endsWith('.ttf'))
  ) {
    // Cache-first with background network update (Stale-while-revalidate for local assets)
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // C. Default: Network with Cache Fallback for other GET assets
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// 4. MESSAGE: Handle update trigger from the UI [Actualizar]
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
