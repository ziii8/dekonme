/* ============================================= */
/*   Service Worker Optimisé — DEKONme v2.1   */
/*   Cache stratégies + offline + image opt    */
/* ============================================= */

const CACHE_VERSION = 'dekonme-v2.1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets critiques (cached au premier install)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/css/style-animated.css',
  '/js/supabase-config.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Pages HTML (pour offline fallback)
const HTML_PAGES = [
  '/index.html',
  '/category.html',
  '/product.html',
  '/profil.html',
  '/favoris.html',
  '/publish.html',
  '/auth.html',
  '/seller.html',
  '/messages.html',
];

/* ==================== INSTALL ==================== */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting(); // Force activation
      })
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

/* ==================== ACTIVATE ==================== */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE &&
                cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Take control immediately
  );
});

/* ==================== FETCH ==================== */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // ========== IMAGES (Cache First) ==========
  if (request.destination === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetchAndCache(request, IMAGE_CACHE))
        .catch(() => {
          // Fallback image pour offline
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="#f0ebe3" width="400" height="300"/><text x="200" y="150" font-size="16" text-anchor="middle" fill="#6b6660">Image indisponible</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        })
    );
    return;
  }

  // ========== API CALLS (Network First + Cache) ==========
  if (url.hostname === 'dwupdusgmqrohwekjslz.supabase.co' || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            // Cache successful responses
            const clonedResponse = response.clone();
            caches.open(API_CACHE)
              .then((cache) => cache.put(request, clonedResponse));
          }
          return response;
        })
        .catch(() => {
          // Fallback à cache si offline
          return caches.match(request)
            .then((cached) => cached || new Response(
              JSON.stringify({ error: 'Offline — données en cache' }),
              { headers: { 'Content-Type': 'application/json' } }
            ));
        })
    );
    return;
  }

  // ========== CSS/JS (Stale While Revalidate) ==========
  if (/\.(css|js)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          // Return cached immediately, fetch in background
          if (cached) {
            fetch(request)
              .then((response) => {
                if (response.ok) {
                  caches.open(DYNAMIC_CACHE)
                    .then((cache) => cache.put(request, response.clone()));
                }
              })
              .catch(() => {});
            return cached;
          }
          return fetchAndCache(request, DYNAMIC_CACHE);
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ========== HTML PAGES (Network First) ==========
  if (request.mode === 'navigate' || /\.html$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => cache.put(request, clonedResponse));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cached) => cached || caches.match('/offline.html')
              .then((offline) => offline || new Response(
                '<html><body style="font-family:system-ui;text-align:center;padding:40px;color:#6b6660;"><h1>📵 Hors ligne</h1><p>Vous êtes hors ligne. Vérifiez votre connexion.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              ))
            );
        })
    );
    return;
  }

  // ========== AUTRES (Cache First fallback Network) ==========
  event.respondWith(
    caches.match(request)
      .then((cached) => cached || fetch(request)
        .then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => cache.put(request, clonedResponse));
          }
          return response;
        })
      )
      .catch(() => caches.match('/index.html'))
  );
});

/* ==================== HELPERS ==================== */
function fetchAndCache(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const clonedResponse = response.clone();
      caches.open(cacheName)
        .then((cache) => cache.put(request, clonedResponse));
      return response;
    })
    .catch((err) => {
      console.error('[SW] Fetch failed:', err);
      throw err;
    });
}

/* ==================== MESSAGE HANDLER (Communication) ==================== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

console.log('[SW] Service Worker loaded');