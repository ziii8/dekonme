// functions/annonce/[slug].js
//
// Cloudflare Pages Function : intercepte /annonce/:slug-:id AVANT que le HTML
// n'arrive au navigateur ou au crawler WhatsApp/Facebook, et injecte les
// balises OpenGraph (og:title, og:image, og:description) dynamiquement.
// Indispensable car WhatsApp ne lit QUE le HTML brut, il n'exécute jamais app.js.
//
// Fichier placé sous /functions/annonce/[slug].js => capture automatiquement
// /annonce/<n'importe-quoi> grâce au routing par dossier de Cloudflare Pages.

const SUPABASE_URL = 'https://msqmyzwmddiyuirazfrp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcW15endtZGRpeXVpcmF6ZnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE3NzEsImV4cCI6MjA5NzUzNzc3MX0.BkkaPRGVMlBUmcJjMavddIwIGOuwcLMGwpd1Fo6X9no';

// Extrait l'UUID à la fin d'un slug du type "chaussures-nike-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
function extractIdFromSlug(pathSegment) {
  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  const match = pathSegment.match(uuidRegex);
  return match ? match[1] : null;
}

function escapeForHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatPriceFCFA(price) {
  if (!price) return '0';
  return new Intl.NumberFormat('fr-FR').format(Math.floor(price));
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // params.slug correspond au segment après /annonce/ (ex: "chaussures-nike-abc123...")
  const pathSegment = params.slug || url.pathname.split('/').filter(Boolean).pop() || '';
  const listingId = extractIdFromSlug(pathSegment);

  // IMPORTANT : les règles du fichier _redirects NE s'appliquent PAS aux requêtes
  // interceptées par une Pages Function, même si le chemin correspond.
  // On va donc chercher product.html nous-mêmes via le binding ASSETS,
  // au lieu de compter sur un rewrite _redirects qui ne se déclenchera jamais ici.
  const assetUrl = new URL('/product.html', url.origin);
  let response = await env.ASSETS.fetch(new Request(assetUrl, request));

  if (!listingId) {
    return response;
  }

  try {
    const apiRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=title,price,city,images,image_url`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!apiRes.ok) return response;

    const rows = await apiRes.json();
    const listing = rows && rows[0];
    if (!listing) return response;

    const title = escapeForHtmlAttr(listing.title || 'Annonce sur DEKONme');
    const price = formatPriceFCFA(listing.price);
    const city = escapeForHtmlAttr(listing.city || 'Togo');
    const image = escapeForHtmlAttr(
      listing.image_url ||
      (listing.images && listing.images[0]) ||
      `https://picsum.photos/seed/${listingId}/1200/630`
    );
    const description = `${price} FCFA · ${city} · Disponible sur DEKONme`;
    const pageUrl = escapeForHtmlAttr(url.href);

    let html = await response.text();

    // L'URL affichée est /annonce/slug-id, donc il n'y a pas de "?id=..." pour app.js.
    // On injecte l'ID dans une variable globale que product.html doit lire en secours
    // (voir instructions : ajouter le fallback dans le script qui charge la fiche produit).
    const ogTags = `
    <meta property="og:type" content="product">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${escapeForHtmlAttr(description)}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:site_name" content="DEKONme">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${escapeForHtmlAttr(description)}">
    <meta name="twitter:image" content="${image}">
    <title>${title} — DEKONme</title>
    <script>window.__DEKONME_LISTING_ID__ = ${JSON.stringify(listingId)};</script>
  </head>`;

    html = html.replace('</head>', ogTags);

    return new Response(html, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    console.error('Erreur og-meta function:', err);
    return response;
  }
}
html = html.replace('</head>', ogTags);

    // AJOUT : injecte aussi le contenu visible dans le corps de la page
    // (le robot AdSense ne lit que le HTML brut, comme WhatsApp)
    html = html
      .replace('<!--TITRE-->', title)
      .replace('<!--PRIX-->', `${price} FCFA`)
      .replace('<!--VILLE-->', city);

    return new Response(html, {
      status: response.status,
      headers: response.headers,
    });
