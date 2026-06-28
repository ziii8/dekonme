/* ============================================= */
/*   DEKONme — app.js                            */
/*   Logique partagée : données (Supabase),       */
/*   recherche, favoris, auth, contact WhatsApp   */
/* ============================================= */

// Catégories principales du marketplace (utilisées sur l'accueil,
// la page catégories, et le formulaire de publication)
const CATEGORIES = [
  { name: "Mode",        emoji: "👗", color: "#F3E7DC" },
  { name: "Électronique",emoji: "📱", color: "#DCEAF3" },
  { name: "Maison",      emoji: "🛋️", color: "#E2EDD9" },
  { name: "Beauté",      emoji: "💄", color: "#F3DCE6" },
  { name: "Sport",       emoji: "⚽", color: "#EAE0F3" },
  { name: "Accessoires", emoji: "👜", color: "#F3ECDC" }
];

// Marques conservées pour le champ "Marque" du formulaire de publication
// (utile pour l'Électronique notamment, facultatif pour les autres catégories)
const PHONE_BRANDS = [
  "Apple", "Samsung", "Tecno", "Infinix", "Itel",
  "Huawei", "Xiaomi", "Oppo", "Vivo", "Nokia", "Autre"
];

function formatPrice(n) {
  return Number(n).toLocaleString('fr-FR').replace(/,/g, ' ');
}

// ==================== ANNONCES (Supabase) ====================
// Toutes les pages lisent les annonces via ces fonctions — plus de
// tableau LISTINGS en dur. Chaque fonction est async : on l'appelle
// avec await depuis le script de chaque page.

// limit/offset permettent la pagination sur l'accueil.
// Par défaut sans argument : charge les 6 premières annonces.
async function getAllListings(limit = 6, offset = 0) {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) { console.error('Erreur chargement annonces :', error); return []; }
  return data;
}

// Compte le total d'annonces actives — utilisé pour savoir
// si on affiche ou masque le bouton "Voir plus".
async function countAllListings() {
  const { count, error } = await db
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) { console.error('Erreur comptage :', error); return 0; }
  return count || 0;
}

async function getListingById(id) {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.error('Erreur chargement annonce :', error); return null; }
  return data;
}

async function getListingsByCategory(category) {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('category', category)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur chargement annonces :', error); return []; }
  return data;
}

async function searchListings(term) {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .or(`title.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur recherche :', error); return []; }
  return data;
}

async function countByCategory(category) {
  const { count, error } = await db
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('category', category)
    .eq('status', 'active');
  if (error) { console.error('Erreur comptage :', error); return 0; }
  return count || 0;
}

// Crée une annonce. Suppose que l'utilisateur est déjà connecté
// (vérifié en amont par requireAuth() sur la page publish.html).
// images : tableau d'URLs (2 à 5). image_url garde la première, pour
// compatibilité avec le code existant qui ne lit qu'une seule image.
async function createListing(listing) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Non connecté' };

  const profile = await getMyProfile();

  const { data, error } = await db
    .from('listings')
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
      seller_name: profile ? profile.name : 'Vendeur DEKONme'
    })
    .select()
    .single();

  if (error) { console.error('Erreur publication :', error); return { error: error.message }; }
  return { data };
}

// Modifie une annonce existante. RLS garantit côté serveur que seul le
// propriétaire peut réussir cette opération (voir policy "update" du schéma).
async function updateListing(id, listing) {
  const { data, error } = await db
    .from('listings')
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
    .eq('id', id)
    .select()
    .single();

  if (error) { console.error('Erreur modification :', error); return { error: error.message }; }
  return { data };
}

// Marque une annonce comme vendue. Elle disparaît de l'accueil, des
// catégories et des favoris des autres, mais reste dans "Mes annonces".
async function markAsSold(id) {
  const { data, error } = await db
    .from('listings')
    .update({ status: 'sold' })
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('Erreur signalement vente :', error); return { error: error.message }; }
  return { data };
}

async function getMyListings() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur chargement mes annonces :', error); return []; }
  return data;
}

// ==================== UPLOAD PHOTOS (jusqu'à 5) ====================
// Envoie plusieurs photos dans le bucket "listing-photos" sous
// user_id/horodatage-index.ext, renvoie la liste des URLs publiques
// dans le même ordre que les fichiers fournis.
async function uploadListingPhotos(files) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Non connecté' };

  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}-${i}.${ext}`;

    const { error: uploadError } = await db.storage
      .from('listing-photos')
      .upload(path, file, { upsert: false });

    if (uploadError) { console.error('Erreur upload photo :', uploadError); return { error: uploadError.message }; }

    const { data } = db.storage.from('listing-photos').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return { urls };
}

// ==================== FAVORIS (Supabase) ====================
async function getFavoriteIds() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id);
  if (error) { console.error('Erreur favoris :', error); return []; }
  return data.map(f => f.listing_id);
}

async function getFavoriteListings() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from('favorites')
    .select('listing_id, listings(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur favoris :', error); return []; }
  // On filtre les annonces vendues après la jointure (syntaxe plus simple
  // qu'un filtre imbriqué côté Supabase, volume de favoris faible par utilisateur).
  return data.map(f => f.listings).filter(l => l && l.status === 'active');
}

async function isFavorite(listingId) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return false;
  const { data, error } = await db
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

window.toggleFavorite = async function (id, btnEl) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) { window.location.href = `auth.html?next=${encodeURIComponent(location.pathname.split('/').pop())}`; return; }

  const already = await isFavorite(id);
  if (already) {
    await db.from('favorites').delete().eq('user_id', user.id).eq('listing_id', id);
  } else {
    await db.from('favorites').insert({ user_id: user.id, listing_id: id });
  }
  if (btnEl) btnEl.classList.toggle('active', !already);
};

// ==================== AUTH (Supabase, email + mot de passe) ====================
// Auth par email — gratuite et activée par défaut chez Supabase, contrairement
// à l'auth par téléphone qui exige un fournisseur SMS payant (Twilio etc.)
// même quand on désactive la confirmation. Le numéro WhatsApp reste stocké
// dans la table profiles et sert uniquement au bouton de contact, pas à la connexion.

function toE164(phone) {
  // Convertit "228 90 11 22 33" ou "90111223" en format international.
  // Ajoute l'indicatif Togo (+228) si absent. Utilisé pour stocker/afficher
  // le numéro WhatsApp proprement, plus pour l'authentification.
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('228')) return '+' + digits;
  return '+228' + digits;
}

async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function isLoggedIn() {
  return !!(await getCurrentUser());
}

async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) { console.error('Erreur profil :', error); return null; }
  return data;
}

// ==================== PRÉSENCE EN LIGNE ====================
// Met à jour last_seen toutes les 30 secondes pour l'utilisateur connecté.
// Appelé depuis renderBottomNav() — présent sur toutes les pages.
async function updatePresence() {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', user.id);
}

// Lance la mise à jour de présence en tâche de fond.
// Appelé une seule fois au chargement de chaque page (dans renderBottomNav).
function startPresenceHeartbeat() {
  updatePresence(); // mise à jour immédiate à l'arrivée sur la page
  setInterval(updatePresence, 30000); // puis toutes les 30 secondes
}

// Retourne un objet { label, color, dot } selon last_seen du vendeur.
// Utilisé sur product.html et seller.html pour afficher le statut.
function getOnlineStatus(lastSeen) {
  if (!lastSeen) return { label: '', dot: '' };
  const diffMin = Math.floor((Date.now() - new Date(lastSeen)) / 60000);
  if (diffMin < 3)  return { label: 'En ligne',          dot: '🟢' };
  if (diffMin < 60) return { label: `Vu il y a ${diffMin} min`, dot: '🟡' };
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return { label: `Vu il y a ${diffH}h`,     dot: '⚪' };
  return { label: '', dot: '' }; // au-delà de 24h, on n'affiche rien
}

// ==================== PROFIL VENDEUR PUBLIC ====================
// Lecture publique du profil d'un vendeur (nom, ville, date d'inscription)
// et de ses annonces actives — accessible sans connexion, comme une
// page boutique simplifiée.
async function getSellerProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) { console.error('Erreur profil vendeur :', error); return null; }
  return data;
}

async function getListingsBySeller(userId) {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur annonces vendeur :', error); return []; }
  return data;
}

// ==================== SIGNALEMENT D'ANNONCE ====================
// Ouvert à tous, connecté ou non — reporter_id reste vide si la
// personne n'est pas connectée (voir policy RLS côté Supabase).
async function reportListing(listingId, reason, comment) {
  const user = await getCurrentUser();
  const { error } = await db.from('reports').insert({
    listing_id: listingId,
    reporter_id: user ? user.id : null,
    reason,
    comment: comment || null
  });
  if (error) { console.error('Erreur signalement :', error); return { error: error.message }; }
  return { success: true };
}

async function signUpUser({ name, email, phone, city, password }) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // Le profil public (nom, ville, téléphone WhatsApp) est stocké séparément
  // de auth.users, qui ne gère que l'identifiant de connexion (email).
  const { error: profileError } = await db.from('profiles').insert({
    id: data.user.id,
    name,
    phone: toE164(phone),
    city
  });
  if (profileError) return { error: profileError.message };

  return { data };
}

async function signInUser({ email, password }) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { data };
}

window.logoutUser = async function () {
  stopPresenceHeartbeat();
  await db.auth.signOut();
  window.location.href = 'index.html';
};

// ==================== PRÉSENCE EN LIGNE ====================
// Toutes les 30 secondes, si l'utilisateur est connecté, on met à jour
// last_seen dans son profil. Ça permet d'afficher "En ligne" / "Vu il y a Xh"
// sur la fiche produit et la page vendeur.
// Consommation Supabase : ~2 requêtes/minute par utilisateur connecté,
// très en dessous du quota gratuit (500 Mo/mois de bande passante).

let _heartbeatTimer = null;

async function startPresenceHeartbeat() {
  const user = await getCurrentUser();
  if (!user) return;

  async function ping() {
    await db.from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', user.id);
  }

  ping(); // immédiatement au chargement
  _heartbeatTimer = setInterval(ping, 30000); // puis toutes les 30s

  // Arrêt propre si l'onglet se ferme
  window.addEventListener('beforeunload', stopPresenceHeartbeat);
}

function stopPresenceHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
}

// Retourne un objet { label, isOnline } selon le last_seen du profil.
// "En ligne" = vu il y a moins de 2 minutes
// "Vu il y a X" = entre 2 minutes et 24h
// null = jamais vu (compte jamais connecté après migration)
function getPresenceStatus(lastSeen) {
  if (!lastSeen) return null;
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 2) return { label: 'En ligne', isOnline: true };
  if (diffMin < 60) return { label: `Vu il y a ${diffMin} min`, isOnline: false };
  if (diffH < 24) return { label: `Vu il y a ${diffH}h`, isOnline: false };
  if (diffD === 1) return { label: 'Vu hier', isOnline: false };
  if (diffD < 7) return { label: `Vu il y a ${diffD} jours`, isOnline: false };
  return { label: 'Rarement connecté', isOnline: false };
}

function presenceBadgeHTML(lastSeen) {
  const status = getPresenceStatus(lastSeen);
  if (!status) return '';
  return `<span class="presence-badge ${status.isOnline ? 'online' : 'offline'}">${status.isOnline ? '🟢' : '🕐'} ${status.label}</span>`;
}

// Redirige vers la connexion si nécessaire. À appeler en haut des
// scripts de page protégés, AVEC await : if (!(await requireAuth())) return;
async function requireAuth(redirectBackTo) {
  const logged = await isLoggedIn();
  if (!logged) {
    const back = redirectBackTo || window.location.pathname.split('/').pop();
    window.location.href = `auth.html?next=${encodeURIComponent(back)}`;
    return false;
  }
  return true;
}

// ==================== WHATSAPP ====================
window.contactWhatsApp = function (phone, productLabel, price, listingId) {
  if (!phone) return;
  const cleanPhone = toE164(String(phone)).replace(/\D/g, '');

  let text = 'Bonjour, je suis intéressé(e) par votre annonce sur DEKONme.';
  if (productLabel) {
    text = `Bonjour, je suis intéressé(e) par : ${productLabel}`;
    if (price) text += ` (${formatPrice(price)} FCFA)`;
  }
  if (listingId && productLabel) {
    text += `\n${buildShareUrl(listingId, productLabel)}`;
  }

  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
};

// ==================== PARTAGE D'ANNONCE ====================
// Utilise le partage natif du téléphone (Web Share API) quand disponible
// — l'utilisateur choisit alors WhatsApp, SMS, email, etc. lui-même.
// Sinon (ordinateur, navigateur non compatible), on ouvre directement
// un partage WhatsApp en repli.
//
// Format du lien partagé : /nom-du-produit-ID (ex: /iphone-12-pro-max-128-go-7)
// au lieu de /product.html?id=7 — plus lisible dans un message WhatsApp.
// L'ID reste à la fin, séparé par un tiret, pour que le lien continue de
// fonctionner même si le titre de l'annonce change après publication.
// Ce format n'est compréhensible par le serveur qu'UNE FOIS le fichier
// _redirects (Netlify) actif après la mise en ligne — voir ce fichier
// à la racine du projet. En local (Live Server), ce lien ne fonctionnera
// pas tel quel ; product.html?id=X reste utilisé pour la navigation interne.
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildShareUrl(id, title) {
  const slug = slugify(title);
  const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
  return `${base}${slug}-${id}`;
}

window.shareListing = async function (id, title, price) {
  const url = buildShareUrl(id, title);
  const text = `${title} — ${formatPrice(price)} FCFA sur DEKONme`;

  if (navigator.share) {
    try {
      await navigator.share({ title: text, url });
    } catch (e) {
      // L'utilisateur a annulé le partage — rien à faire.
    }
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank', 'noopener');
  }
};

// ==================== CARTE PRODUIT (HTML partagé) ====================
// fav (bool) doit être calculé en amont par l'appelant — productCardHTML
// n'est plus async pour rester simple à utiliser dans des .map().
function productCardHTML(l, fav) {
  const favClass = fav ? 'active' : '';
  const image = l.image_url || l.image || 'https://picsum.photos/seed/' + l.id + '/600/600';
  return `
    <div class="product-card" onclick="goToProduct(${l.id})">
      <div class="img-wrap">
        <img src="${image}" alt="${l.title}" loading="lazy">
        <button class="fav-btn ${favClass}" onclick="event.stopPropagation(); toggleFavorite(${l.id}, this)" aria-label="Favori">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
      </div>
      <div class="product-info">
        <h4>${l.title}</h4>
        <div class="price-row">
          <span class="price">${formatPrice(l.price)} F</span>
        </div>
        <p class="meta">${l.city} · ${l.condition}</p>
      </div>
    </div>
  `;
}

// Construit le HTML d'une grille de cartes en résolvant les favoris
// en une seule requête (plutôt qu'un appel réseau par carte).
async function renderListingGrid(listings) {
  const favIds = await getFavoriteIds();
  return listings.map(l => productCardHTML(l, favIds.includes(l.id))).join('');
}

window.goToProduct = function (id) {
  window.location.href = `product.html?id=${id}`;
};

// ==================== RECHERCHE (partagée entre pages) ====================
window.performSearch = function () {
  const input = document.getElementById('searchInput');
  const term = input ? input.value.trim() : '';
  if (!term) return;
  window.location.href = `category.html?q=${encodeURIComponent(term)}`;
};

// ==================== MENU DÉROULANT (hamburger) ====================
window.toggleDropdown = function () {
  document.getElementById('dropdownMenu')?.classList.toggle('open');
};

// ==================== BOTTOM NAV (statique, injectée sur chaque page) ====================
// Nav fixe à 5 boutons : Accueil, Catégorie, Publier, Favoris, Compte.
// "Publier" est centré et mis en avant (style bouton +).
function renderBottomNav(active) {
  const mount = document.getElementById('bottomNav');
  if (!mount) return;

  // Lance le heartbeat de présence si l'utilisateur est connecté.
  // Appel non-bloquant (pas d'await) — la nav s'affiche immédiatement.
  startPresenceHeartbeat();

  const items = [
    { key: 'accueil',    href: 'index.html',                      label: 'Accueil',    icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { key: 'categories', href: 'category.html?view=categories',   label: 'Catégorie', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
    { key: 'publier',    href: '#',                               label: 'Publier',   icon: 'M12 5v14M5 12h14', isPublish: true },
    { key: 'favoris',    href: 'favoris.html',                    label: 'Favoris',   icon: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
    { key: 'profil',     href: 'profil.html',                     label: 'Compte',    icon: 'M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z' }
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
      <a href="${it.href}" class="${it.key === active ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${it.icon}"/></svg>
        ${it.label}
      </a>
    `;
  }).join('');
}

// ==================== NAVIGATION RACCOURCIS ====================
window.showPublish = async function () {
  window.location.href = (await isLoggedIn()) ? 'publish.html' : 'auth.html?next=publish.html';
};

window.toggleLoginModal = function () {
  window.location.href = 'auth.html';
};

// ==================== THÈME (dark / light) ====================
// Trois états possibles sur <html> :
//   .dark  → mode sombre forcé (override du système)
//   .light → mode clair forcé (override du système)
//   rien   → suit automatiquement le préréglage du téléphone
//
// Le choix est mémorisé dans localStorage sous 'dekonme-theme'.

function applyTheme() {
  const saved = localStorage.getItem('dekonme-theme');
  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  if (saved) html.classList.add(saved); // 'dark' ou 'light' mémorisé
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const isDark = document.documentElement.classList.contains('dark') ||
    (!document.documentElement.classList.contains('light') &&
     window.matchMedia('(prefers-color-scheme: dark)').matches);
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Passer en mode clair' : 'Passer en mode sombre';
}

window.toggleTheme = function () {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark') ||
    (!html.classList.contains('light') &&
     window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'light' : 'dark';
  html.classList.remove('dark', 'light');
  html.classList.add(next);
  localStorage.setItem('dekonme-theme', next);
  updateThemeIcon();
};

// Appliquer le thème dès que le DOM est prêt
applyTheme();

// Réagir si l'utilisateur change le thème système pendant la visite
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!localStorage.getItem('dekonme-theme')) updateThemeIcon();
});

// ==================== PWA : enregistrement du service worker ====================
// Permet l'installation sur l'écran d'accueil. Échoue silencieusement
// sur les navigateurs qui ne supportent pas les service workers, ou
// si servi en file:// (cas attendu en test local sans Live Server).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('Service worker non enregistré :', err.message);
    });
  });
}