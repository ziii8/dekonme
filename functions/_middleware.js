// functions/_middleware.js
//
// Injecte du contenu réel Supabase dans les pages qui en ont besoin (visible
// sans JavaScript, pour la conformité AdSense).
//
// Les fiches produit individuelles NE sont PAS gérées ici : elles sont
// gérées par functions/annonce/[slug].js (URLs /annonce/<id ou slug-id>).
//
// À PERSONNALISER :
//   - SUPABASE_KEY ci-dessous (même valeur que dans functions/annonce/[slug].js)
//   - Noms de colonnes non confirmés : category_id, seller_id (à vérifier
//     dans votre schéma réel). "title" et "price" sont confirmés via
//     [slug].js, qui utilise déjà la table "listings" avec ces noms.

const SUPABASE_URL = "https://msqmyzwmddiyuirazfrp.supabase.co";
const SUPABASE_KEY = "COLLEZ_ICI_LA_MEME_CLE_QUE_DANS_SLUG_JS";

async function supabaseQuery(chemin) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

async function injecter(context, remplacements) {
  const asset = await context.env.ASSETS.fetch(context.request);
  let html = await asset.text();
  for (const [marqueur, contenu] of Object.entries(remplacements)) {
    html = html.split(marqueur).join(contenu);
  }
  return new Response(html, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
}

// Lien vers une fiche produit : /annonce/<id> suffit, [slug].js n'a besoin
// que de l'UUID à la fin du segment pour retrouver l'annonce.
function listeAnnonces(annonces) {
  return annonces
    .map(
      (a) => `<li><a href="/annonce/${a.id}">${a.title} — ${a.price} FCFA</a></li>`
    )
    .join("");
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const id = url.searchParams.get("id");

  // Page d'accueil : aperçu des catégories + dernières annonces
  if (path === "/" || path === "/index.html") {
    const categories = await supabaseQuery("categories?select=*&limit=8");
    const annonces = await supabaseQuery(
      "listings?select=*&order=created_at.desc&limit=8"
    );
    return injecter(context, {
      "<!--CATEGORIES-->": categories
        .map((c) => `<li><a href="/category.html?id=${c.id}">${c.nom}</a></li>`)
        .join(""),
      "<!--ANNONCES-->": listeAnnonces(annonces),
    });
  }

  // Page catégorie : annonces filtrées par catégorie
  if (path === "/category.html" && id) {
    const annonces = await supabaseQuery(`listings?category_id=eq.${id}&select=*`);
    return injecter(context, { "<!--ANNONCES-->": listeAnnonces(annonces) });
  }

  // Vitrine vendeur : infos du vendeur + ses annonces
  if (path === "/seller.html" && id) {
    const [vendeur] = await supabaseQuery(`vendeurs?id=eq.${id}&select=*`);
    const annonces = await supabaseQuery(`listings?seller_id=eq.${id}&select=*`);
    return injecter(context, {
      "<!--NOM_VENDEUR-->": vendeur ? vendeur.nom : "",
      "<!--ANNONCES-->": listeAnnonces(annonces),
    });
  }

  // /annonce/... => géré par functions/annonce/[slug].js, pas ici.
  // auth, profil, publish, favoris, CSS, JS, images... passent normalement.
  return context.next();
}
