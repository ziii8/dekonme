/* ============================================= */
/* DEKONme — app.js v3.6 (Auth complet + Animations) */
/* Logique Globale & Rendu UI Marketplace         */
/* CORRIGÉ : onclick UUID + admin.deleteUser bug  */
/* ============================================= */

const CATEGORIES = [
  { name: "Mode",        emoji: "👗", color: "#F3E7DC" },
  { name: "Électronique",emoji: "📱", color: "#DCEAF3" },
  { name: "Maison",      emoji: "🛋️", color: "#E2EDD9" },
  { name: "Beauté",      emoji: "💄", color: "#F3DCE6" },
  { name: "Sport",       emoji: "⚽", color: "#EAE0F3" },
  { name: "Accessoires", emoji: "👜", color: "#F3ECDC" }
];

const PHONE_BRANDS = ["Apple","Samsung","Tecno","Infinix","Itel","Huawei","Xiaomi","Oppo","Vivo","Nokia","Autre"];

let _heartbeatTimer = null;

/* ============================================================
   ANIMATIONS — CSS injecté une seule fois
============================================================ */
(function injectAnimationStyles() {
  if (document.getElementById('dekonme-anim-styles')) return;

  const style = document.createElement('style');
  style.id = 'dekonme-anim-styles';
  style.textContent = `
    @keyframes dkm-card-in {
      from { opacity: 0; transform: translateY(14px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .product-card {
      opacity: 0;
      animation: dkm-card-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      will-change: transform, opacity;
    }
    .product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 24px rgba(0,0,0,0.08);
    }
    .product-card:active {
      transform: translateY(-1px) scale(0.99);
    }

    .product-card img {
      opacity: 0;
      transition: opacity 0.35s ease;
    }
    .product-card img.dkm-loaded {
      opacity: 1;
    }

    @keyframes dkm-heart-pop {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.35); }
      55%  { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    .fav-btn svg {
      transition: fill 0.2s ease, stroke 0.2s ease;
    }
    .fav-btn.dkm-pop svg {
      animation: dkm-heart-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .fav-btn.active svg {
      color: #E8567A;
    }

    .btn, .nav-publish-circle, .fav-btn {
      position: relative;
      overflow: hidden;
    }
    .dkm-ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255,255,255,0.55);
      transform: scale(0);
      animation: dkm-ripple-anim 0.55s ease-out;
      pointer-events: none;
    }
    @keyframes dkm-ripple-anim {
      to { transform: scale(2.8); opacity: 0; }
    }

    @keyframes dkm-toast-in {
      from { opacity: 0; transform: translate(-50%, 12px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }
    @keyframes dkm-toast-out {
      from { opacity: 1; transform: translate(-50%, 0); }
      to   { opacity: 0; transform: translate(-50%, 12px); }
    }
    .dkm-toast {
      position: fixed;
      left: 50%;
      bottom: 90px;
      z-index: 9999;
      padding: 12px 20px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 500;
      color: #fff;
      background: #2b2b2b;
      box-shadow: 0 8px 20px rgba(0,0,0,0.18);
      animation: dkm-toast-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      white-space: nowrap;
    }
    .dkm-toast.dkm-toast-error { background: #D64545; }
    .dkm-toast.dkm-toast-success { background: #2E9E5B; }
    .dkm-toast.dkm-toast-out { animation: dkm-toast-out 0.25s ease forwards; }

    .security-modal {
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .security-modal.open { opacity: 1; }
    .security-modal-content {
      transform: translateY(30px) scale(0.97);
      transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .security-modal.open .security-modal-content {
      transform: translateY(0) scale(1);
    }

    #bottomNav a.active svg {
      animation: dkm-nav-bounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes dkm-nav-bounce {
      0% { transform: scale(1); }
      50% { transform: scale(1.18); }
      100% { transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .product-card, .fav-btn.dkm-pop svg, .dkm-toast, .security-modal-content, #bottomNav a.active svg {
        animation: none !important;
        transition: none !important;
      }
    }

    /* --- Skeleton loaders (chargement) --- */
    @keyframes dkm-skeleton-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .dkm-skeleton-card {
      border-radius: 16px;
      overflow: hidden;
      background: var(--white, #fff);
      border: 1px solid var(--border, #eee);
    }
    .dkm-skeleton-img {
      width: 100%;
      aspect-ratio: 1;
      background: linear-gradient(90deg, #eee 0px, #f6f6f6 40px, #eee 80px);
      background-size: 800px 100%;
      animation: dkm-skeleton-shimmer 1.4s ease-in-out infinite;
    }
    .dkm-skeleton-line {
      height: 12px;
      margin: 10px 10px 0;
      border-radius: 6px;
      background: linear-gradient(90deg, #eee 0px, #f6f6f6 40px, #eee 80px);
      background-size: 800px 100%;
      animation: dkm-skeleton-shimmer 1.4s ease-in-out infinite;
    }
    .dkm-skeleton-line.short { width: 50%; margin-bottom: 10px; }
    .dkm-skeleton-line.medium { width: 75%; }

    /* --- Sentinelle de scroll infini (invisible, juste un déclencheur) --- */
    .dkm-scroll-sentinel {
      width: 100%;
      height: 1px;
    }
    .dkm-infinite-spinner {
      display: flex;
      justify-content: center;
      padding: 20px 0;
    }
    @keyframes dkm-spin { to { transform: rotate(360deg); } }
    .dkm-infinite-spinner .dot {
      width: 22px;
      height: 22px;
      border: 3px solid var(--border, #eee);
      border-top-color: var(--orange, #E8732C);
      border-radius: 50%;
      animation: dkm-spin 0.7s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .dkm-skeleton-img, .dkm-skeleton-line, .dkm-infinite-spinner .dot {
        animation: none !important;
      }
    }
  `;
  document.head.appendChild(style);
})();

/* Génère N cartes "skeleton" (placeholders animés) pendant le chargement */
function renderSkeletonCards(count = 6) {
  return Array.from({ length: count }).map(() => `
    <div class="dkm-skeleton-card">
      <div class="dkm-skeleton-img"></div>
      <div class="dkm-skeleton-line medium"></div>
      <div class="dkm-skeleton-line short"></div>
    </div>
  `).join('');
}

/* Attache un scroll infini à un conteneur : appelle loadMoreFn() quand la
   sentinelle devient visible. loadMoreFn doit renvoyer une Promise et gérer
   elle-même l'ajout du contenu + la mise à jour de hasMore(). */
function attachInfiniteScroll({ sentinelId, hasMore, loadMore, spinnerId }) {
  const sentinel = document.getElementById(sentinelId);
  if (!sentinel || typeof IntersectionObserver === 'undefined') return null;

  let loading = false;
  const observer = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || loading || !hasMore()) return;
    loading = true;
    const spinner = spinnerId ? document.getElementById(spinnerId) : null;
    if (spinner) spinner.style.display = 'flex';
    try {
      await loadMore();
    } finally {
      loading = false;
      if (spinner) spinner.style.display = hasMore() ? 'flex' : 'none';
      if (!hasMore() && observer) observer.disconnect();
    }
  }, { rootMargin: '300px' });

  observer.observe(sentinel);
  return observer;
}

function staggerProductCards(containerSelector = null) {
  const cards = containerSelector
    ? document.querySelectorAll(`${containerSelector} .product-card`)
    : document.querySelectorAll('.product-card');
  cards.forEach((card, i) => {
    card.style.animationDelay = `${Math.min(i * 45, 400)}ms`;
  });
}

function attachRipple(el, event) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  const x = (event?.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
  const y = (event?.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;
  ripple.className = 'dkm-ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  el.appendChild(ripple);
  setTimeout(() => ripple.remove(), 550);
}
document.addEventListener('click', (e) => {
  const target = e.target.closest('.btn, .nav-publish-circle');
  if (target) attachRipple(target, e);
});

function showToast(message, type = 'default', duration = 2600) {
  const toast = document.createElement('div');
  toast.className = `dkm-toast ${type === 'error' ? 'dkm-toast-error' : type === 'success' ? 'dkm-toast-success' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('dkm-toast-out');
    setTimeout(() => toast.remove(), 280);
  }, duration);
}
if (!window.showToast) window.showToast = showToast;

/* ==================== getCategories ==================== */
function getCategories() {
  return Promise.resolve(CATEGORIES);
}

/* ==================== SÉCURITÉ & FORMATAGE ==================== */
function escapeHtml(text) {
  if (text == null) return "";
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

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
  if (error) { console.error("Erreur chargement annonces :", error); return []; }
  return data;
}

async function countAllListings() {
  if (!window.db) return 0;
  const { count, error } = await window.db
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (error) { console.error("Erreur comptage :", error); return 0; }
  return count || 0;
}

async function getListingById(id) {
  if (!window.db) return null;
  const { data, error } = await window.db
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("Erreur chargement annonce :", error); return null; }
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
  if (error) { console.error("Erreur chargement annonces :", error); return []; }
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
  if (error) { console.error("Erreur recherche :", error); return []; }
  return data;
}

async function countByCategory(category) {
  if (!window.db) return 0;
  const { count, error } = await window.db
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("category", category)
    .eq("status", "active");
  if (error) { console.error("Erreur comptage :", error); return 0; }
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
      user_id:     user.id,
      title:       listing.title,
      brand:       listing.brand,
      model:       listing.model,
      price:       listing.price,
      city:        listing.city,
      condition:   listing.condition,
      category:    listing.category,
      description: listing.description,
      whatsapp:    listing.whatsapp,
      images:      listing.images,
      image_url:   listing.images[0],
      seller_name: profile ? profile.name : "Vendeur DEKONme"
    })
    .select()
    .single();

  if (error) { console.error("Erreur publication :", error); return { error: error.message }; }
  return { data };
}

async function updateListing(id, listing) {
  if (!window.db) return { error: "Base de données non initialisée" };
  const { data, error } = await window.db
    .from("listings")
    .update({
      title:       listing.title,
      brand:       listing.brand,
      model:       listing.model,
      price:       listing.price,
      city:        listing.city,
      condition:   listing.condition,
      category:    listing.category,
      description: listing.description,
      whatsapp:    listing.whatsapp,
      images:      listing.images,
      image_url:   listing.images[0]
    })
    .eq("id", id)
    .select()
    .single();

  if (error) { console.error("Erreur modification :", error); return { error: error.message }; }
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
  if (error) { console.error("Erreur signalement vente :", error); return { error: error.message }; }
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
  if (error) { console.error("Erreur chargement mes annonces :", error); return []; }
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

/* ==================== AUTHENTIFICATION & PROFILES ==================== */
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
  if (error) { console.error("Erreur profil :", error); return null; }
  return data;
}

async function getSellerProfile(userId) {
  if (!window.db) return null;
  const { data, error } = await window.db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) { console.error("Erreur profil vendeur :", error); return null; }
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
  if (error) { console.error("Erreur annonces vendeur :", error); return []; }
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

  const { data: { user }, error: authError } = await window.db.auth.signUp({
    email,
    password,
    options: { data: { name, phone, city } }
  });

  if (authError) return { error: authError.message };

  const { error: profileError } = await window.db
    .from("profiles")
    .insert({
      id: user.id,
      name,
      phone: toE164(phone),
      city
    });

  if (profileError) {
    // CORRIGÉ : auth.admin.deleteUser() nécessite la service_role key
    // et ne peut PAS être appelé depuis le client avec la clé anon.
    // On log l'incident au lieu de planter avec une exception non gérée.
    // Un vrai nettoyage du compte orphelin doit passer par une Edge Function
    // Supabase côté serveur (avec service_role key), jamais ici.
    console.error("Erreur création profil (compte Auth orphelin possible) :", profileError, "user_id:", user?.id);
    return { error: "Erreur lors de la création du profil. Réessayez ou contactez le support." };
  }

  return { data: user, redirect: "/profil.html" };
}

async function signInUser({ email, password }) {
  if (!window.db) return { error: "Base de données non définie" };
  const { data, error } = await window.db.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { data };
}

window.logoutUser = async function () {
  stopPresenceHeartbeat();
  if (window.db) await window.db.auth.signOut();
  window.location.href = "/index.html";
};

/* ==================== FAVORIS ==================== */
async function getFavoriteIds() {
  if (!window.db) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await window.db.from("favorites").select("listing_id").eq("user_id", user.id);
  if (error) { console.error("Erreur favoris :", error); return []; }
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
  if (error) { console.error("Erreur favoris :", error); return []; }
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
      if (svg) svg.setAttribute("fill", !already ? "currentColor" : "none");

      if (!already) {
        btnEl.classList.remove('dkm-pop');
        void btnEl.offsetWidth;
        btnEl.classList.add('dkm-pop');
        setTimeout(() => btnEl.classList.remove('dkm-pop'), 450);
      }
    }
  } catch (err) {
    console.error("Erreur toggleFavorite :", err);
  }
};

/* ==================== RÉSEAUX SOCIAUX (Utilitaire) ==================== */
function extractSocialHandle(input, platform) {
  if (!input) return "";
  let handle = input.trim();
  handle = handle
    .replace(/(https?:\/\/)?(www\.)?facebook\.com\//i, "")
    .replace(/(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/(https?:\/\/)?(www\.)?tiktok\.com\/@?/i, "");
  return handle.replace(/[@/]/g, "").trim();
}

function getSocialUrl(platform, handle) {
  if (!handle) return "";
  const clean = extractSocialHandle(handle, platform);
  if (platform === 'facebook')  return `https://facebook.com/${clean}`;
  if (platform === 'instagram') return `https://instagram.com/${clean}`;
  if (platform === 'tiktok')    return `https://tiktok.com/@${clean}`;
  return "#";
}

/* ==================== PRÉSENCE ==================== */
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
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
}

function getPresenceStatus(lastSeen) {
  if (!lastSeen) return null;
  const diffMs  = Date.now() - new Date(lastSeen).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH / 24);
  if (diffMin < 2)  return { label: "En ligne",              isOnline: true  };
  if (diffMin < 60) return { label: `Vu il y a ${diffMin} min`, isOnline: false };
  if (diffH < 24)   return { label: `Vu il y a ${diffH}h`,   isOnline: false };
  if (diffD === 1)  return { label: "Vu hier",               isOnline: false };
  if (diffD < 7)    return { label: `Vu il y a ${diffD} jours`, isOnline: false };
  return { label: "Rarement connecté", isOnline: false };
}

function presenceBadgeHTML(lastSeen) {
  const status = getPresenceStatus(lastSeen);
  if (!status) return "";
  return `<span class="presence-badge ${status.isOnline ? "online" : "offline"}">${status.isOnline ? "🟢" : "🕐"} ${status.label}</span>`;
}

/* ==================== WHATSAPP, SIGNALEMENT & PARTAGE ==================== */
window.contactWhatsApp = function (phone, productLabel, price, listingId) {
  if (!phone) return;

  const modalHTML = `
    <div class="security-modal">
      <div class="security-modal-content">
        <div class="security-lottie">
          <div class="cadenas-container">
            <div class="cadenas"></div>
          </div>
        </div>

        <h2>⚠️ Sécurité DEKONme</h2>
        
        <div class="security-checklist">
          <div class="check-item">✅ Je ne paie jamais d’acompte avant de voir et tester le produit</div>
          <div class="check-item">✅ Je vérifie toujours l’article en personne</div>
          <div class="check-item">✅ Je ne donne jamais mon OTP à un inconnu</div>
        </div>

        <label class="security-checkbox">
          <input type="checkbox" id="securityConfirm">
          <span>J’ai bien lu et accepté les règles de sécurité DEKONme</span>
        </label>

        <div class="security-buttons">
          <button id="cancelBtn" class="btn btn-outline">Annuler</button>
          <button id="continueBtn" class="btn btn-primary">Continuer vers WhatsApp</button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHTML;
  document.body.appendChild(container);

  const modal = container.firstElementChild;
  const checkbox = document.getElementById('securityConfirm');
  const continueBtn = document.getElementById('continueBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  setTimeout(() => { modal.classList.add('open'); }, 10);

  function closeModal() {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 400);
  }

  cancelBtn.addEventListener('click', closeModal);

  continueBtn.addEventListener('click', () => {
    if (!checkbox.checked) {
      showToast('Veuillez cocher la case pour continuer', 'error');
      return;
    }
    closeModal();

    const cleanPhone = toE164(String(phone)).replace(/\D/g, "");
    let text = "Bonjour, je suis intéressé(e) par votre annonce sur DEKONme.";
    if (productLabel) text = `Bonjour, je suis intéressé(e) par l'article : ${productLabel}`;
    if (price) text += ` (${formatPrice(price)} FCFA)`;
    if (listingId) text += `\nLien de l'article : ${buildShareUrl(listingId, productLabel)}`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });

  [continueBtn, cancelBtn].forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.05)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
  });
};

window.shareListing = async function (id, title, price) {
  const url  = buildShareUrl(id, title);
  const text = `${title} — ${formatPrice(price)} FCFA sur DEKONme`;
  if (navigator.share) {
    try { await navigator.share({ title: text, url: url }); }
    catch (e) { console.warn("[Share] Annulé ou non supporté"); }
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank", "noopener");
  }
};

async function reportListing(listingId, reason, comment) {
  if (!window.db) return { error: "Non connecté à Supabase" };
  const user = await getCurrentUser();
  const { error } = await window.db.from("reports").insert({
    listing_id:  listingId,
    reporter_id: user ? user.id : null,
    reason:      reason,
    comment:     comment || null
  });
  if (error) { console.error("Erreur signalement :", error); return { error: error.message }; }
  return { success: true };
}

/* ==================== RENDU GRILLES ==================== */
function productCardHTML(l, fav) {
  const favClass = fav ? "active" : "";
  const image = l.image_url || (l.images && l.images[0]) || `https://picsum.photos/seed/${l.id}/600/600`;
  const safeId = escapeHtml(String(l.id));
  return `
    <div class="product-card" onclick="goToProduct('${safeId}')">
      <div class="img-wrap">
        <img
          data-src="${image}"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
          alt="${escapeHtml(l.title)}"
          onload="this.classList.add('dkm-loaded')"
        >
        <button class="fav-btn ${favClass}" onclick="event.stopPropagation(); toggleFavorite('${safeId}', this)" aria-label="Favori">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${fav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
      </div>
      <div class="product-info">
        <h4>${escapeHtml(l.title)}</h4>
        <div class="price-row">
          <span class="price">${formatPrice(l.price)} FCFA</span>
        </div>
        <p class="meta">${escapeHtml(l.city || "Lomé")} · ${escapeHtml(l.condition || "Non spécifié")}</p>
      </div>
    </div>
  `;
}

async function renderListingGrid(listings) {
  const favIds = await getFavoriteIds();
  const html = listings.map(l => productCardHTML(l, favIds.includes(l.id))).join("");
  requestAnimationFrame(() => staggerProductCards());
  return html;
}

window.goToProduct = function (id) {
  window.location.href = `/product.html?id=${encodeURIComponent(id)}`;
};

window.performSearch = function () {
  const input = document.getElementById("searchInput");
  const term  = input ? input.value.trim() : "";
  if (!term) return;
  window.location.href = `/category.html?q=${encodeURIComponent(term)}`;
};

/* ==================== BOTTOM NAV & THEME ==================== */
function renderBottomNav(active) {
  const mount = document.getElementById("bottomNav");
  if (!mount) return;
  startPresenceHeartbeat();
  const items = [
    { key: "accueil",    href: "/index.html",                   label: "Accueil",     icon: "M3 12l9-9 9 9M5 10v10h14V10" },
    { key: "categories", href: "/category.html?view=categories", label: "Catégories",  icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7H4z" },
    { key: "publier",    href: "#",                              label: "Publier",      icon: "M12 5v14M5 12h14", isPublish: true },
    { key: "favoris",    href: "/favoris.html",                  label: "Favoris",     icon: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" },
    { key: "profil",     href: "/profil.html",                   label: "Compte",      icon: "M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z" }
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

applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!localStorage.getItem("dekonme-theme")) updateThemeIcon();
});

/* ==================== INIT ==================== */
window.updateMyProfile = async function ({ name, phone, city, avatar_emoji }) {
  if (!window.db) return { error: "Base de données non initialisée" };
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté" };
  const { data, error } = await window.db
    .from("profiles")
    .update({ name, phone: toE164(phone), city, avatar_emoji })
    .eq("id", user.id)
    .select()
    .single();
  if (error) { console.error("Erreur modification profil :", error); return { error: error.message }; }
  return { data, success: true };
};