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

// Extrait l'ID à la fin d'un slug du type "t-shirt-disponible-2"
// Les IDs de la table "listings" sont des entiers simples (pas des UUID) —
// seul user_id est un UUID, à ne pas confondre.
function extractIdFromSlug(pathSegment) {
  const match = pathSegment.match(/-(\d+)$/);
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

  // params.slug correspond au segment après /annonce/ (ex: "t-shirt-disponible-2")
  const pathSegment = params.slug || url.pathname.split('/').filter(Boolean).pop() || '';
  const listingId = extractIdFromSlug(pathSegment);

  // FIX : Cloudflare Pages redirige automatiquement /product.html vers /product
  // (comportement "clean URLs" par défaut). En demandant /product.html, on
  // recevait une réponse de redirection (301/308) qu'on propageait telle
  // quelle au navigateur — celui-ci suivait alors la redirection SANS l'ID
  // injecté, d'où "cette annonce n'existe plus". On demande donc directement
  // la forme canonique /product, déjà servie sans redirection.
  const assetUrl = new URL('/product', url.origin);
  let response = await env.ASSETS.fetch(new Request(assetUrl, request));

  // Garde-fou : si Cloudflare renvoie quand même une redirection (301/308),
  // on ne la propage jamais au navigateur — on retente en suivant l'URL
  // indiquée, sinon on abandonne l'injection OG et on sert la réponse brute.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      response = await env.ASSETS.fetch(new Request(new URL(location, url.origin), request));
    }
  }

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
    const fullTitle = `${title} — DEKONme`;

    let html = await response.text();

    // FIX : on remplace le contenu de la balise <title> existante au lieu d'en
    // ajouter une deuxième (deux <title> dans un document = invalide, et les
    // navigateurs privilégient souvent le premier trouvé, donc l'ancien titre
    // générique aurait gagné).
    html = html.replace(/<title>.*?<\/title>/i, `<title>${fullTitle}</title>`);

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
    <script>window.__DEKONME_LISTING_ID__ = ${JSON.stringify(listingId)};</script>
  </head>`;

    html = html.replace('</head>', ogTags);

    // FIX : on reconstruit des headers propres au lieu de recopier ceux de la
    // réponse d'origine — l'ancien Content-Length ne correspond plus à la
    // nouvelle taille du HTML modifié, ce qui peut tronquer la réponse.
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('content-type', 'text/html;charset=UTF-8');

    return new Response(html, {
      status: response.status,
      headers,
    });
  } catch (err) {
    console.error('Erreur og-meta function:', err);
    return response;
  }
}
