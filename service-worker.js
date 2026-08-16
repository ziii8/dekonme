/* ============================================= */
/*   DEKONme — service-worker.js                */
/*   Cache optimisé pour connexions lentes       */
/*   (Togo, mobile 3G/4G)                       */
/*   CORRIGÉ : le fetch "réseau d'abord" pouvait */
/*   quand même renvoyer une réponse mise en     */
/*   cache par le NAVIGATEUR (pas par ce SW),    */
/*   donnant l'impression qu'un déploiement      */
/*   n'était jamais pris en compte.              */
/* ============================================= */

const CACHE_NAME = 'dekonme-shell-v5';

// Fichiers statiques mis en cache à l'installation.
// Le SDK Supabase est inclus — il ne change jamais entre visites,
// autant ne pas le re-télécharger à chaque page.
const SHELL_FILES = [
  '/index.html',
  '/category.html',
  '/product.html',
  '/publish.html',
  '/favoris.html',
  '/profil.html',
  '/auth.html',
  '/seller.html',
  '/a-propos.html',
  '/confidentialite.html',
  '/conditions.html',
  '/comment-ca-marche.html',
  '/css/style.css',
  '/js/app.js',
  '/js/supabase-config.js',
  '/manifest.json',
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
  if (url.includes('cdn.jsdelivr.net') || url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          );
          return response;
        });
      })
    );
    return;
  }

  // CORRIGÉ : requêtes tierces (WhatsApp, AdSense, etc.) qui ne matchent
  // aucun des cas ci-dessus — on ne les met plus en cache par accident,
  // on les laisse filer normalement. Seul notre propre domaine passe par
  // la logique "réseau d'abord, cache en repli" ci-dessous.
  if (new URL(url).origin !== self.location.origin) return;

  // Fichiers locaux (HTML, CSS, JS) : réseau d'abord, cache en repli.
  // Garantit qu'on a toujours la dernière version déployée.
  //
  // CORRIGÉ : { cache: 'reload' } force le navigateur à recontacter le
  // réseau et à ignorer SON PROPRE cache HTTP pour cette requête. Sans ça,
  // fetch(event.request) pouvait renvoyer une réponse mise en cache par le
  // navigateur (selon les en-têtes Cache-Control envoyés par Cloudflare
  // Pages), même si ce Service Worker demandait bien "le réseau d'abord" —
  // d'où l'impression qu'un déploiement n'était jamais pris en compte.
  //
  // Le cache.put() est aussi passé dans event.waitUntil() : sans ça, le
  // Service Worker peut être arrêté par le navigateur juste après avoir
  // renvoyé la réponse, avant que l'écriture dans le cache ne se termine —
  // ce qui rendait le cache de secours (mode hors-ligne) peu fiable.
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((response) => {
        const clone = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        );
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});