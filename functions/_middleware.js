// functions/_middleware.js
// Version corrigée pour le partage et l'ouverture directe des liens d'annonces

const SUPABASE_URL = "https://msqmyzwmddiyuirazfrp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcW15endtZGRpeXVpcmF6ZnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE3NzEsImV4cCI6MjA5NzUzNzc3MX0.BkkaPRGVMlBUmcJjMavddIwIGOuwcLMGwpd1Fo6X9no";

async function supabaseQuery(chemin) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    
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

// Génère les liens au format /annonce.html?id=... pour correspondre au routeur ci-dessous
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
    
    // Récupération de l'ID, soit depuis les paramètres (?id=...), soit depuis l'URL (/annonce/...)
    let id = url.searchParams.get("id");

    // 1. PAGE D'ACCUEIL
    if (path === "/" || path === "/index.html") {
      const [categories, annonces] = await Promise.all([
        supabaseQuery("categories?select=*&limit=8"),
        supabaseQuery("listings?select=*&order=created_at.desc&limit=8")
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
      const annonces = await supabaseQuery(`listings?category_id=eq.${id}&select=*`);
      return injecter(context, { "<!--ANNONCES-->": listeAnnonces(annonces) });
    }

    // 3. PAGE VENDEUR
    if (path === "/seller.html" && id) {
      const [vendeurs, annonces] = await Promise.all([
        supabaseQuery(`vendeurs?id=eq.${id}&select=*`),
        supabaseQuery(`listings?seller_id=eq.${id}&select=*`)
      ]);
      
      const vendeur = vendeurs[0];
      return injecter(context, {
        "<!--NOM_VENDEUR-->": vendeur ? vendeur.nom : "",
        "<!--ANNONCES-->": listeAnnonces(annonces),
      });
    }

    // 4. PAGE DÉTAIL ANNONCE (Gère à la fois /annonce.html?id=XX et /annonce/XX)
    if (path === "/annonce.html" || path.startsWith("/annonce/")) {
      
      // Si l'URL est sous la forme /annonce/123, on extrait l'ID depuis le chemin
      if (path.startsWith("/annonce/")) {
        id = path.split("/")[2];
      }

      if (id) {
        const listings = await supabaseQuery(`listings?id=eq.${id}&select=*`);
        const annonce = listings[0];
        
        if (annonce) {
          return injecter(context, {
            "<!--TITRE_ANNONCE-->": annonce.title,
            "<!--PRIX_ANNONCE-->": `${annonce.price} FCFA`,
            "<!--DESCRIPTION_ANNONCE-->": annonce.description || "Aucune description",
          });
        }
      }
    }

    return context.next();
  } catch (err) {
    console.error("Erreur middleware globale:", err.message);
    return context.next();
  }
}
