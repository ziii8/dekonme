/* ============================================= */
/* DEKONme — app.js v3.3                         */
/* Logique Globale & Rendu UI Marketplace        */
/* ============================================= */

const CATEGORIES = [
  { name: "Mode", emoji: "👗", color: "#F3E7DC" },
  { name: "Électronique", emoji: "📱", color: "#DCEAF3" },
  { name: "Maison", emoji: "🛋️", color: "#E2EDD9" },
  { name: "Beauté", emoji: "💄", color: "#F3DCE6" },
  { name: "Sport", emoji: "⚽", color: "#EAE0F3" },
  { name: "Accessoires", emoji: "👜", color: "#F3ECDC" }
];

const PHONE_BRANDS = ["Apple", "Samsung", "Tecno", "Infinix", "Itel", "Huawei", "Xiaomi", "Oppo", "Vivo", "Nokia", "Autre"];

let _heartbeatTimer = null;

/* ==================== FORMATTAGE & UTILS ==================== */

function formatPrice(n) {
  if (!n) return "0";
  return Number(n).toLocaleString("fr-FR").replace(/,/g, " ");
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildShareUrl(id, title) {
  const slug = slugify(title);
  return `${window.location.origin}/annonce/${slug}-${id}`;
}

function toE164(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("228")) return "+" + digits;
  return "+228" + digits;
}

/* ==================== REQUÊTES SUPABASE (CRUD) ==================== */

async function getAllListings(limit = 6, offset = 0) {
  if (!window.db) return [];
  const { data, error } = await window.db
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Erreur chargement annonces :", error);
    return [];
  }
  return data;
}

async function countAllListings() {
  if (!window.db) return 0;
  const { count, error } = await window.db
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  if (error) {
    console.error("Erreur comptage :", error);
    return 0;
  }
  return count || 0;
}

async function getListingById(id) {
  if (!window.db) return null;
  const { data, error } = await window.db
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erreur chargement annonce :", error);
    return null;
  }
  return data;
}

async function getListingsByCategory(category) {
  if (!window.db) return [];
  const { data, error } = await window.db
    .from("listings")
    .select("*")
    .eq("category", category)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement annonces :", error);
    return [];
  }
  return data;
}

async function searchListings(term) {
  if (!window.db) return [];
  const { data, error } = await window.db
    .from("listings")
    .select("*")
    .or(`title.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur recherche :", error);
    return [];
  }
  return data;
}

async function countByCategory(category) {
  if (!window.db) return 0;
  const { count, error } = await window.db
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("category", category)
    .eq("status", "active");

  if (error) {
    console.error("Erreur comptage :", error);
    return 0;
  }
  return count || 0;
}

async function createListing(listing) {
  if (!window.db) return { error: "Base de données non initialisée" };
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté" };

  const profile = await getMyProfile();
  const { data, error } = await window.db
    .from("listings")
    .insert({
      user_id: user.id,
      title: listing.title,
      brand: listing.brand,
      model: listing.model,
      price: listing.price,
      city: listing.city,
      condition: listing.condition,
      category: listing.category,
      description: listing.description,
      whatsapp: listing.whatsapp,
      images: listing.images,
      image_url: listing.images[0],
      seller_name: profile ? profile.name : "Vendeur DEKONme"
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur publication :", error);
    return { error: error.message };
  }
  return { data };
}

async function updateListing(id, listing) {
  if (!window.db) return { error: "Base de données non initialisée" };
  const { data, error } = await window.db
    .from("listings")
    .update({
      title: listing.title,
      brand: listing.brand,
      model: listing.model,
      price: listing.price,
      city: listing.city,
      condition: listing.condition,
      category: listing.category,
      description: listing.description,
      whatsapp: listing.whatsapp,
      images: listing.images,
      image_url: listing.images[0]
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erreur modification :", error);
    return { error: error.message };
  }
  return { data };
}

async function markAsSold(id) {
  if (!window.db) return { error: "Base de données non initialisée" };
  const { data, error } = await window.db
    .from("listings")
    .update({ status: "sold" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erreur signalement vente :", error);
    return { error: error.message };
  }
  return { data };
}

async function getMyListings() {
  if (!window.db) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await window.db
    .from("listings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement mes annonces :", error);
    return [];
  }
  return data;
}

async function uploadListingPhotos(files) {
  if (!window.db) return { error: "Base de données non initialisée" };
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté" };

  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${i}.${ext}`;

    const { error: uploadError } = await window.db.storage
      .from("listing-photos")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      console.error("Erreur upload photo :", uploadError);
      return { error: uploadError.message };
    }

    const { data } = window.db.storage.from("listing-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return { urls };
}

/* ==================== AUTHENTIFICATION GUARD & PROFILES ==================== */

async function getCurrentUser() {
  if (!window.db) return null;
  const { data: { user } } = await window.db.auth.getUser();
  return user;
}

async function isLoggedIn() {
  const user = await getCurrentUser();
  return !!user;
}

async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await window.db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Erreur profil :", error);
    return null;
  }
  return data;
}

async function getSellerProfile(userId) {
  if (!window.db) return null;
  const { data, error } = await window.db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Erreur profil vendeur :", error);
    return null;
  }
  return data;
}

async function getListingsBySeller(userId) {
  if (!window.db) return [];
  const { data, error } = await window.db
    .from("listings")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur annonces vendeur :", error);
    return [];
  }
  return data;
}

async function requireAuth(redirectBackTo) {
  const logged = await isLoggedIn();
  if (!logged) {
    const back = redirectBackTo || window.location.pathname.split("/").pop() || "index.html";
    window.location.href = `/auth.html?next=${encodeURIComponent(back)}`;
    return false;
  }
  return true;
}

async function signUpUser({ name, email, phone, city, password }) {
  if (!window.db) return { error: "Base de données non définie" };
  const { data, error } = await window.db.auth.signUp({ email, password });
  if (error) return { error: error.message };

  const { error: profileError } = await window.db.from("profiles").insert({
    id: data.user.id,
    name: name,
    phone: toE164(phone),
    city: city
  });

  if (profileError) return { error: profileError.message };
  return { data };
}

async function signInUser({ email, password }) {
  if (!window.db) return { error: "Base de données non définie" };
  const { data, error } = await window.db.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { data };
}

window.logoutUser = async function () {
  stopPresenceHeartbeat();
  if (window.db) {
    await window.db.auth.signOut();
  }
  window.location.href = "/index.html";
};

/* ==================== GESTION DES FAVORIS ==================== */

async function getFavoriteIds() {
  if (!window.db) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await window.db.from("favorites").select("listing_id").eq("user_id", user.id);
  if (error) {
    console.error("Erreur favoris :", error);
    return [];
  }
  return data.map(f => f.listing_id);
}

async function getFavoriteListings() {
  if (!window.db) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await window.db
    .from("favorites")
    .select("listing_id, listings(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur favoris :", error);
    return [];
  }
  return data.map(f => f.listings).filter(l => l && l.status === "active");
}

async function isFavorite(listingId) {
  if (!window.db) return false;
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await window.db
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

window.toggleFavorite = async function (id, btnEl) {
  if (!window.db) return;
  const user = await getCurrentUser();
  
  if (!user) {
    const currentFile = window.location.pathname.split("/").pop() || "index.html";
    window.location.href = `/auth.html?next=${encodeURIComponent(currentFile)}`;
    return;
  }

  try {
    const already = await isFavorite(id);
    if (already) {
      await window.db.from("favorites").delete().eq("user_id", user.id).eq("listing_id", id);
    } else {
      await window.db.from("favorites").insert({ user_id: user.id, listing_id: id });
    }

    if (btnEl) {
      btnEl.classList.toggle("active", !already);
      const svg = btnEl.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", !already ? "currentColor" : "none");
      }
    }
  } catch (err) {
    console.error("Erreur toggleFavorite :", err);
  }
};

/* ==================== DISPONIBILITÉ & PRÉSENCE ==================== */

async function updatePresence() {
  if (!window.db) return;
  const user = await getCurrentUser();
  if (!user) return;
  
  await window.db
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", user.id);
}

function startPresenceHeartbeat() {
  if (_heartbeatTimer) return;
  updatePresence();
  _heartbeatTimer = setInterval(updatePresence, 30000);
  window.addEventListener("beforeunload", stopPresenceHeartbeat);
}

function stopPresenceHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

function getOnlineStatus(lastSeen) {
  if (!lastSeen) return { label: "", dot: "" };
  
  // Correction de la faute de frappe critique ici :
  const diffMin = Math.floor((Date.now() - new Date(lastSeen)) / 60000);
  
  if (diffMin < 3) return { label: "En ligne", dot: "🟢" };
  if (diffMin < 60) return { label: `Vu il y a ${diffMin} min`, dot: "🟡" };
  
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return { label: `Vu il y a ${diffH}h`, dot: "⚪" };
  
  return { label: "", dot: "" };
}

function getPresenceStatus(lastSeen) {
  if (!lastSeen) return null;
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 2) return { label: "En ligne", isOnline: true };
  if (diffMin < 60) return { label: `Vu il y a ${diffMin} min`, isOnline: false };
  if (diffH < 24) return { label: `Vu il y a ${diffH}h`, isOnline: false };
  if (diffD === 1) return { label: "Vu hier", isOnline: false };
  if (diffD < 7) return { label: `Vu il y a ${diffD} jours`, isOnline: false };
  return { label: "Rarement connecté", isOnline: false };
}

function presenceBadgeHTML(lastSeen) {
  const status = getPresenceStatus(lastSeen);
  if (!status) return "";
  return `<span class="presence-badge ${status.isOnline ? "online" : "offline"}">${status.isOnline ? "🟢" : "🕐"} ${status.label}</span>`;
}

/* ==================== ACTIONS WHATSAPP, SIGNALEMENT & PARTAGE ==================== */

window.contactWhatsApp = function (phone, productLabel, price, listingId) {
  if (!phone) return;

  // Pop-up d'interception de sécurité native anti-fraude intégrée
  const acceptSecurity = confirm(
    "⚠️ RAPPEL DE SÉCURITÉ DEKONme :\n\n" +
    "Ne payez JAMAIS d'acompte (via Flooz ou T-Money) avant d'avoir vu, testé et rigoureusement vérifié le produit en personne.\n\n" +
    "Souhaitez-vous toujours contacter ce vendeur ?"
  );
  
  if (!acceptSecurity) return;

  const cleanPhone = toE164(String(phone)).replace(/\D/g, "");
  let text = "Bonjour, je suis intéressé(e) par votre annonce sur DEKONme.";
  
  if (productLabel) {
    text = `Bonjour, je suis intéressé(e) par l'article : ${productLabel}`;
    if (price) text += ` (${formatPrice(price)} FCFA)`;
  }
  if (listingId && productLabel) {
    text += `\nLien de l'article : ${buildShareUrl(listingId, productLabel)}`;
  }
  
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
};

window.shareListing = async function (id, title, price) {
  const url = buildShareUrl(id, title);
  const text = `${title} — ${formatPrice(price)} FCFA sur DEKONme`;
  
  if (navigator.share) {
    try {
      await navigator.share({ title: text, url: url });
    } catch (e) {
      console.warn("[Share] Annulé ou non supporté");
    }
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank", "noopener");
  }
};

async function reportListing(listingId, reason, comment) {
  if (!window.db) return { error: "Non connecté à Supabase" };
  const user = await getCurrentUser();
  const { error } = await window.db.from("reports").insert({
    listing_id: listingId,
    reporter_id: user ? user.id : null,
    reason: reason,
    comment: comment || null
  });
  if (error) {
    console.error("Erreur signalement :", error);
    return { error: error.message };
  }
  return { success: true };
}

/* ==================== RENDU DES GRILLES DE PRODUITS ==================== */

function productCardHTML(l, fav) {
  const favClass = fav ? "active" : "";
  const image = l.image_url || (l.images && l.images[0]) || `https://picsum.photos/seed/${l.id}/600/600`;
  
  return `
    <div class="product-card" onclick="goToProduct(${l.id})">
      <div class="img-wrap">
        <img data-src="${image}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="${l.title}">
        <button class="fav-btn ${favClass}" onclick="event.stopPropagation(); toggleFavorite(${l.id}, this)" aria-label="Favori">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${fav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
      </div>
      <div class="product-info">
        <h4>${l.title}</h4>
        <div class="price-row">
          <span class="price">${formatPrice(l.price)} F</span>
        </div>
        <p class="meta">${l.city || "Lomé"} · ${l.condition || "Non spécifié"}</p>
      </div>
    </div>
  `;
}

async function renderListingGrid(listings) {
  const favIds = await getFavoriteIds();
  return listings.map(l => productCardHTML(l, favIds.includes(l.id))).join("");
}

window.goToProduct = function (id) {
  window.location.href = `/product.html?id=${id}`;
};

window.performSearch = function () {
  const input = document.getElementById("searchInput");
  const term = input ? input.value.trim() : "";
  if (!term) return;
  window.location.href = `/category.html?q=${encodeURIComponent(term)}`;
};

/* ==================== INTERFACE UNIFIÉE & THEME ==================== */

window.toggleDropdown = function () {
  document.getElementById("dropdownMenu")?.classList.toggle("open");
};

function renderBottomNav(active) {
  const mount = document.getElementById("bottomNav");
  if (!mount) return;
  
  startPresenceHeartbeat();

  const items = [
    { key: "accueil", href: "/index.html", label: "Accueil", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
    { key: "categories", href: "/category.html?view=categories", label: "Catégories", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7H4z" },
    { key: "publier", href: "#", label: "Publier", icon: "M12 5v14M5 12h14", isPublish: true },
    { key: "favoris", href: "/favoris.html", label: "Favoris", icon: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" },
    { key: "profil", href: "/profil.html", label: "Compte", icon: "M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z" }
  ];

  mount.innerHTML = items.map(it => {
    if (it.isPublish) {
      return `
        <a href="#" class="nav-publish-btn" onclick="event.preventDefault(); showPublish();">
          <span class="nav-publish-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${it.icon}"/></svg>
          </span>
          ${it.label}
        </a>
      `;
    }
    return `
      <a href="${it.href}" class="${it.key === active ? "active" : ""}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${it.icon}"/></svg>
        ${it.label}
      </a>
    `;
  }).join("");
}

window.showPublish = async function () {
  const authCheck = await isLoggedIn();
  window.location.href = authCheck ? "/publish.html" : "/auth.html?next=publish.html";
};

/* ==================== THEME DARK / LIGHT ==================== */

function applyTheme() {
  const saved = localStorage.getItem("dekonme-theme");
  const htmlEl = document.documentElement;
  htmlEl.classList.remove("dark", "light");
  if (saved) htmlEl.classList.add(saved);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  const isDark = document.documentElement.classList.contains("dark") || 
                 (!document.documentElement.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  btn.textContent = isDark ? "☀️" : "🌙";
  btn.title = isDark ? "Passer en mode clair" : "Passer en mode sombre";
}

window.toggleTheme = function () {
  const htmlEl = document.documentElement;
  const isDark = htmlEl.classList.contains("dark") || 
                 (!htmlEl.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const nextTheme = isDark ? "light" : "dark";
  htmlEl.classList.remove("dark", "light");
  htmlEl.classList.add(nextTheme);
  localStorage.setItem("dekonme-theme", nextTheme);
  updateThemeIcon();
};

// Initialisation du thème
applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!localStorage.getItem("dekonme-theme")) updateThemeIcon();
});

/* ==================== SERVICE WORKER REGISTRATION ==================== */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .then(reg => {
        // Mise à jour en tâche de fond toutes les heures
        setInterval(() => { reg.update(); }, 3600000);
      })
      .catch(err => {
        console.warn("[PWA] Service worker non enregistré :", err.message);
      });
  });
}
async function updateMyProfile({ name, phone, city, avatar_emoji }) {
  if (!window.db) return { error: "Base de données non initialisée" };
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté" };

  const { data, error } = await window.db
    .from("profiles")
    .update({
      name: name,
      phone: toE164(phone), 
      city: city,
      avatar_emoji: avatar_emoji // Ajout de l'émoji ici pour garder le fichier de fonctions à jour
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Erreur lors de la modification du profil :", error);
    return { error: error.message };
  }
  return { data, success: true };
}