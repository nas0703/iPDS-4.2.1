/**
 * iPDS Service Worker - v4.2.1
 * Progressive Web App & Offline Caching Engine for FPMSB Tunggal
 */

const CACHE_NAME = 'ipds-cache-v4.2.2';
const OFFLINE_FALLBACK_URL = '/index.html';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  '/icons/icon-maskable.svg'
];

// Install event - Pre-cache application shell defensively
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[iPDS SW v4.1.0] Pre-caching core application shell...');
      for (const asset of PRECACHE_ASSETS) {
        try {
          const response = await fetch(asset, { cache: 'no-cache' });
          if (response && response.status === 200) {
            await cache.put(asset, response);
          } else {
            console.warn('[iPDS SW v4.1.0] Pre-cache skipped non-200 asset:', asset, response?.status);
          }
        } catch (err) {
          console.warn('[iPDS SW v4.1.0] Pre-cache asset notice:', asset, err);
        }
      }
    })
  );
});

// Activate event - Delete legacy caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[iPDS SW v4.1.0] Deleting obsolete cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Smart Strategy with Guaranteed Offline Navigation Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Bypass Vite dev server internal assets, source files, and version-stamped chunks
  if (
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('__vite') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  const isNavigation = 
    request.mode === 'navigate' || 
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  // 1. Navigation Requests (HTML Page Loading / Subroutes): Network-First with Guaranteed Offline Shell
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
              cache.put('/index.html', copy.clone());
              cache.put('/', copy.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Device is offline or server unreachable - serve cached HTML
          console.warn('[iPDS SW] Offline navigation fallback triggered for:', request.url);
          const cachedPage = 
            (await caches.match(request)) || 
            (await caches.match('/index.html')) || 
            (await caches.match('/'));

          if (cachedPage) {
            return cachedPage;
          }

          // Emergency inline HTML if cache was completely cleared
          return new Response(
            `<!DOCTYPE html>
            <html lang="ms">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>iPDS - Mod Luar Talian</title>
              <style>
                body { background: #031315; color: #ffffff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
                .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 30px; border-radius: 16px; max-width: 400px; width: 100%; }
                h1 { font-size: 20px; color: #10b981; margin-bottom: 8px; }
                p { color: #9ca3af; font-size: 14px; line-height: 1.5; }
                button { background: #10b981; color: #ffffff; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 16px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>iPDS - Mod Luar Talian</h1>
                <p>Aplikasi sedang berjalan dalam mod tanpa sambungan internet. Sila mulakan semula aplikasi atau muat semula halaman apabila sambungan sedia ada.</p>
                <button onclick="window.location.reload()">Muat Semula</button>
              </div>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 2. API Routes & Supabase Data Requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedData = await caches.match(request);
          if (cachedData) {
            return cachedData;
          }
          return new Response(
            JSON.stringify({ 
              error: 'Mod Luar Talian: Sambungan internet terputus.', 
              offline: true 
            }),
            { 
              status: 200, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images, Fonts, PWA Icons): Cache-First with Network Revalidation & Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Return empty response for script/styles if missing in cache to avoid browser crash
          if (request.destination === 'script') {
            return new Response('console.warn("[iPDS SW] Script loaded offline fallback.");', {
              headers: { 'Content-Type': 'application/javascript' }
            });
          }
          if (request.destination === 'style') {
            return new Response('/* Offline Style Fallback */', {
              headers: { 'Content-Type': 'text/css' }
            });
          }
          return new Response('', { status: 404 });
        });

      return cachedResponse || fetchPromise;
    })
  );
});

