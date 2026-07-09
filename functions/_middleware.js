// functions/_middleware.js
//
// Injecte du contenu réel Supabase dans les pages qui en ont besoin.
// Version robuste : toute erreur (mauvaise clé, table introuvable, panne
// réseau...) fait retomber sur la page normale au lieu de planter le site
// (c'est ce qui causait l'erreur Cloudflare 1101).
//
// VÉRIFIEZ EN PREMIER : SUPABASE_KEY doit être la vraie clé, pas un texte
// de remplacement (c'est la cause la plus probable du plantage).

const SUPABASE_URL = "https://msqmyzwmddiyuirazfrp.supabase.co";
const SUPABASE_KEY = "COLLEZ_ICI_LA_MEME_CLE_QUE_DANS_SLUG_JS"; // <-- à remplacer

async function supabaseQuery(chemin) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      // Supabase a renvoyé une erreur (mauvaise clé, mauvaise table...)
      // au lieu d'une liste : on le note dans les logs et on traite comme
      // "vide" plutôt que de planter toute la page.
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
      (a) => `<li><a href="/annonce/${a.id}">${a.title} — ${a.price} FCFA</a></li>`
    )
    .join("");
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const path = url.pathname;
    const id = url.searchParams.get("id");

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

    if (path === "/category.html" && id) {
      const annonces = await supabaseQuery(`listings?category_id=eq.${id}&select=*`);
      return injecter(context, { "<!--ANNONCES-->": listeAnnonces(annonces) });
    }

    if (path === "/seller.html" && id) {
      const vendeurs = await supabaseQuery(`vendeurs?id=eq.${id}&select=*`);
      const vendeur = vendeurs[0];
      const annonces = await supabaseQuery(`listings?seller_id=eq.${id}&select=*`);
      return injecter(context, {
        "<!--NOM_VENDEUR-->": vendeur ? vendeur.nom : "",
        "<!--ANNONCES-->": listeAnnonces(annonces),
      });
    }

    return context.next();
  } catch (err) {
    // Filet de sécurité global : plutôt que de planter tout le site
    // (erreur 1101), on sert la page normale en cas de bug imprévu.
    console.error("Erreur middleware:", err.message);
    return context.next();
  }
}
