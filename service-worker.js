/* ============================================= */
/*   DEKONme — service-worker.js                */
/*   Cache optimisé pour connexions lentes       */
/*   (Togo, mobile 3G/4G)                       */
/* ============================================= */

const CACHE_NAME = 'dekonme-shell-v3';

// Fichiers statiques mis en cache à l'installation.
// Le SDK Supabase est inclus — il ne change jamais entre visites,
// autant ne pas le re-télécharger à chaque page.
const SHELL_FILES = [
  'index.html',
  'category.html',
  'product.html',
  'publish.html',
  'favoris.html',
  'profil.html',
  'auth.html',
  'seller.html',
  'css/style.css',
  'js/app.js',
  'js/supabase-config.js',
  'manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Requêtes Supabase (données) : jamais en cache — toujours fraîches.
  if (url.includes('supabase.co')) return;
  if (event.request.method !== 'GET') return;

  // CDN (SDK Supabase, etc.) : cache d'abord — ces fichiers ne changent pas.
  // Gain majeur sur connexion lente : plus besoin de les re-télécharger.
  if (url.includes('cdn.jsdelivr.net') || url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Fichiers locaux (HTML, CSS, JS) : réseau d'abord, cache en repli.
  // Garantit qu'on a toujours la dernière version déployée sur Netlify.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});