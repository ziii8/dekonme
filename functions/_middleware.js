// functions/_middleware.js
//
// Intercepte les pages qui ont besoin de contenu réel injecté avant envoi,
// pour que les annonces/catégories/vendeurs soient visibles sans JavaScript
// (donc visibles par le robot qui vérifie la conformité AdSense).
//
// À PERSONNALISER avant déploiement :
//   1. SUPABASE_URL et SUPABASE_KEY ci-dessous
//   2. Les noms de tables/colonnes (categories, annonces, vendeurs, titre,
//      prix, category_id, seller_id...) selon votre schéma réel
//   3. Les marqueurs <!--...--> doivent exister dans vos fichiers HTML
//      (index.html, category.html, product.html, seller.html)

const SUPABASE_URL = "https://msqmyzwmddiyuirazfrp.supabase.co";
const SUPABASE_KEY = "const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcW15endtZGRpeXVpcmF6ZnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE3NzEsImV4cCI6MjA5NzUzNzc3MX0.BkkaPRGVMlBUmcJjMavddIwIGOuwcLMGwpd1Fo6X9no";
";

// Appelle l'API REST de Supabase et retourne les résultats en JSON
async function supabaseQuery(chemin) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

// Récupère le HTML statique existant et remplace les marqueurs <!--...-->
// par du vrai contenu texte
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

// Construit une liste <li> d'annonces à partir des résultats Supabase
function listeAnnonces(annonces) {
  return annonces
    .map(
      (a) =>
        `<li><a href="/product.html?id=${a.id}">${a.titre} — ${a.prix} FCFA</a></li>`
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
      "annonces?select=*&order=created_at.desc&limit=8"
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
    const annonces = await supabaseQuery(
      `annonces?category_id=eq.${id}&select=*`
    );
    return injecter(context, { "<!--ANNONCES-->": listeAnnonces(annonces) });
  }

  // Fiche annonce : détail d'un seul produit (page prioritaire)
  if (path === "/product.html" && id) {
    const [produit] = await supabaseQuery(`annonces?id=eq.${id}&select=*`);
    if (produit) {
      return injecter(context, {
        "<!--TITRE-->": produit.titre,
        "<!--DESCRIPTION-->": produit.description,
        "<!--PRIX-->": `${produit.prix} FCFA`,
      });
    }
  }

  // Vitrine vendeur : infos du vendeur + ses annonces
  if (path === "/seller.html" && id) {
    const [vendeur] = await supabaseQuery(`vendeurs?id=eq.${id}&select=*`);
    const annonces = await supabaseQuery(`annonces?seller_id=eq.${id}&select=*`);
    return injecter(context, {
      "<!--NOM_VENDEUR-->": vendeur ? vendeur.nom : "",
      "<!--ANNONCES-->": listeAnnonces(annonces),
    });
  }

  // auth.html, profil.html, publish.html, favoris.html, CSS, JS, images...
  // passent normalement, sans modification. Retirez plutôt le script AdSense
  // directement de ces 4 fichiers HTML (voir message précédent).
  return context.next();
}
