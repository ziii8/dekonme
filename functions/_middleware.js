// functions/_middleware.js
// Version corrigée : Sécurisée (variables d'environnement) et optimisée (requêtes parallèles)

const SUPABASE_URL = "https://msqmyzwmddiyuirazfrp.supabase.co";

async function supabaseQuery(chemin, apiKey) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    });
    
    // Vérifie que Supabase renvoie bien du JSON (évite le crash si le serveur renvoie du texte/HTML)
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Supabase n'a pas renvoyé de JSON:", res.status);
      return [];
    }

    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      console.error("Erreur Supabase:", chemin, JSON.stringify(data));
      return [];
    }
    return data;
  } catch (err) {
    console.error("Erreur réseau Supabase:", err.message);
    return [];
  }
}

async function injecter(context, remplacements) {
  try {
    const asset = await context.env.ASSETS.fetch(context.request);
    let html = await asset.text();
    for (const [marqueur, contenu] of Object.entries(remplacements)) {
      html = html.split(marqueur).join(contenu);
    }
    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  } catch (err) {
    console.error("Erreur injection:", err.message);
    return context.next();
  }
}

function listeAnnonces(annonces) {
  return annonces
    .map(
      (a) => `<li><a href="/annonce.html?id=${a.id}">${a.title} — ${a.price} FCFA</a></li>`
    )
    .join("");
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const path = url.pathname;
    const id = url.searchParams.get("id");
    
    // Récupération de la clé depuis l'environnement Cloudflare pour éviter les fuites de sécurité
    const apiKey = context.env.SUPABASE_KEY;
    if (!apiKey) {
      console.error("Variable d'environnement SUPABASE_KEY manquante dans Cloudflare !");
      return context.next();
    }

    // 1. PAGE D'ACCUEIL (Requêtes exécutées en parallèle)
    if (path === "/" || path === "/index.html") {
      const [categories, annonces] = await Promise.all([
        supabaseQuery("categories?select=*&limit=8", apiKey),
        supabaseQuery("listings?select=*&order=created_at.desc&limit=8", apiKey)
      ]);

      return injecter(context, {
        "<!--CATEGORIES-->": categories
          .map((c) => `<li><a href="/category.html?id=${c.id}">${c.nom}</a></li>`)
          .join(""),
        "<!--ANNONCES-->": listeAnnonces(annonces),
      });
    }

    // 2. PAGE CATEGORIE
    if (path === "/category.html" && id) {
      const annonces = await supabaseQuery(`listings?category_id=eq.${id}&select=*`, apiKey);
      return injecter(context, { "<!--ANNONCES-->": listeAnnonces(annonces) });
    }

    // 3. PAGE VENDEUR (Requêtes exécutées en parallèle)
    if (path === "/seller.html" && id) {
      const [vendeurs, annonces] = await Promise.all([
        supabaseQuery(`vendeurs?id=eq.${id}&select=*`, apiKey),
        supabaseQuery(`listings?seller_id=eq.${id}&select=*`, apiKey)
      ]);
      
      const vendeur = vendeurs[0];
      return injecter(context, {
        "<!--NOM_VENDEUR-->": vendeur ? vendeur.nom : "",
        "<!--ANNONCES-->": listeAnnonces(annonces),
      });
    }

    // 4. PAGE DETAIL ANNONCE
    if (path === "/annonce.html" && id) {
      const listings = await supabaseQuery(`listings?id=eq.${id}&select=*`, apiKey);
      const annonce = listings[0];
      
      return injecter(context, {
        "<!--TITRE_ANNONCE-->": annonce ? annonce.title : "Annonce introuvable",
        "<!--PRIX_ANNONCE-->": annonce ? `${annonce.price} FCFA` : "",
        "<!--DESCRIPTION_ANNONCE-->": annonce ? annonce.description : "",
      });
    }

    return context.next();
  } catch (err) {
    console.error("Erreur middleware globale:", err.message);
    return context.next();
  }
}
