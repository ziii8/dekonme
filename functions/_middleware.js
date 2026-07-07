// functions/annonce/[slug].js
//
// Cloudflare Pages Function : intercepte /annonce/:slug-:id AVANT que le HTML
// n'arrive au navigateur ou au crawler WhatsApp/Facebook.
//
// - Balises OpenGraph dans <head> (déjà présent) : pour les aperçus de lien
//   WhatsApp/Facebook, qui ne lisent que le HTML brut.
// - NOUVEAU : texte visible dans <body> (titre, prix, ville, description) :
//   c'est ce que le robot de conformité AdSense doit voir. Les balises OG
//   seules ne suffisent pas, elles sont invisibles pour un lecteur normal.

const SUPABASE_URL = 'https://msqmyzwmddiyuirazfrp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcW15endtZGRpeXVpcmF6ZnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE3NzEsImV4cCI6MjA5NzUzNzc3MX0.BkkaPRGVMlBUmcJjMavddIwIGOuwcLMGwpd1Fo6X9no';

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

  const pathSegment = params.slug || url.pathname.split('/').filter(Boolean).pop() || '';
  const listingId = extractIdFromSlug(pathSegment);

  const assetUrl = new URL('/product.html', url.origin);
  let response = await env.ASSETS.fetch(new Request(assetUrl, request));

  if (!listingId) {
    return response;
  }

  try {
    const apiRes = await fetch(
      // AJOUT : "description" dans le select. Vérifiez que ce nom de colonne
      // correspond bien à votre table "listings" (sinon, adaptez-le).
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=title,price,city,images,image_url,description`,
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
    // Renommé (avant : "description") pour ne pas confondre avec la vraie
    // description du produit, utilisée plus bas.
    const ogDescription = `${price} FCFA · ${city} · Disponible sur DEKONme`;
    const pageUrl = escapeForHtmlAttr(url.href);

    let html = await response.text();

    const ogTags = `
    <meta property="og:type" content="product">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${escapeForHtmlAttr(ogDescription)}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:site_name" content="DEKONme">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${escapeForHtmlAttr(ogDescription)}">
    <meta name="twitter:image" content="${image}">
    <title>${title} — DEKONme</title>
    <script>window.__DEKONME_LISTING_ID__ = ${JSON.stringify(listingId)};</script>
  </head>`;

    html = html.replace('</head>', ogTags);

    // NOUVEAU : contenu visible dans le <body>, pour la conformité AdSense.
    // Ces 4 marqueurs doivent exister dans le corps de product.html, à
    // l'endroit exact où le titre/prix/ville/description doivent apparaître.
    html = html
      .replace('<!--TITRE-->', title)
      .replace('<!--PRIX-->', `${price} FCFA`)
      .replace('<!--VILLE-->', city)
      .replace('<!--DESCRIPTION-->', escapeForHtmlAttr(listing.description || ogDescription));

    return new Response(html, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    console.error('Erreur og-meta function:', err);
    return response;
  }
}
