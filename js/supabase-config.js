/* ============================================= */
/*   DEKONme — supabase-config.js                */
/*   Client Supabase (CDN SAFE VERSION + DATA)   */
/* ============================================= */

const SUPABASE_URL = "https://msqmyzwmddiyuirazfrp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcW15endtZGRpeXVpcmF6ZnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE3NzEsImV4cCI6MjA5NzUzNzc3MX0.BkkaPRGVMlBUmcJjMavddIwIGOuwcLMGwpd1Fo6X9no";

// ==================== INITIALISATION SAFE ====================

let db = window.db;

if (!db) {
  if (!window.supabase) {
    console.error("❌ Supabase CDN non chargé. Vérifie le script dans HTML.");
  } else {
    db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }
}

window.db = db;

// ==================== FONCTIONS UTILITAIRES ====================

// 🔹 Utilisateur actuel
async function getCurrentUser() {
  try {
    if (!db) return null;
    const { data: { user } } = await db.auth.getUser();
    return user || null;
  } catch (error) {
    console.error("Erreur getCurrentUser :", error);
    return null;
  }
}

// 🔹 Profil utilisateur
async function getMyProfile() {
  try {
    if (!db) return null;
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erreur profil :', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Erreur getMyProfile :", error);
    return null;
  }
}

// 🔹 Annonces d'un vendeur spécifique (pour son profil public)
async function getSellerListings(userId) {
  try {
    if (!db || !userId) return [];
    const { data, error } = await db
      .from('listings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erreur getSellerListings :", error);
    return [];
  }
}

// 🔹 Mes propres annonces (Vendeur connecté)
async function getMyListings() {
  const user = await getCurrentUser();
  if (!user) return [];
  return getSellerListings(user.id);
}

/* =================================================== */
/*  FONCTIONS DE RECHERCHE & CATÉGORIES (category.html) */
/* =================================================== */

// 🔹 Compter les annonces par catégorie
async function countByCategory(categoryName) {
  try {
    if (!db) return 0;
    const { count, error } = await db
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('category', categoryName);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error(`Erreur countByCategory pour ${categoryName} :`, error);
    return 0;
  }
}

// 🔹 Récupérer les annonces d'une catégorie
async function getListingsByCategory(categoryName) {
  try {
    if (!db) return [];
    const { data, error } = await db
      .from('listings')
      .select('*')
      .eq('category', categoryName)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erreur getListingsByCategory :", error);
    return [];
  }
}

// 🔹 Récupérer toutes les annonces (avec une limite optionnelle)
async function getAllListings(limit = 100) {
  try {
    if (!db) return [];
    const { data, error } = await db
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erreur getAllListings :", error);
    return [];
  }
}

// 🔹 Moteur de recherche plein texte (titre / description / ville)
async function searchListings(queryText) {
  try {
    if (!db) return [];
    if (!queryText || queryText.trim() === "") return getAllListings();

    const cleanQuery = queryText.trim();
    const { data, error } = await db
      .from('listings')
      .select('*')
      .or(`title.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%,city.ilike.%${cleanQuery}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erreur searchListings :", error);
    return [];
  }
}

/* =================================================== */
/*            GESTION DES FAVORIS (favoris.html)        */
/* =================================================== */

// 🔹 Récupérer les annonces favorites de l'utilisateur connecté
async function getFavoriteListings() {
  try {
    if (!db) return [];
    const user = await getCurrentUser();
    if (!user) return [];

    // 1. On cherche d'abord les IDs des favoris dans la table d'association
    const { data: favData, error: favError } = await db
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id);

    if (favError) throw favError;
    if (!favData || favData.length === 0) return [];

    const listingIds = favData.map(f => f.listing_id);

    // 2. On hydrate ces IDs en allant chercher les données des annonces correspondantes
    const { data: listings, error: listingsError } = await db
      .from('listings')
      .select('*')
      .in('id', listingIds)
      .order('created_at', { ascending: false });

    if (listingsError) throw listingsError;
    return listings || [];

  } catch (error) {
    console.error("Erreur getFavoriteListings :", error);
    return [];
  }
}

// ==================== EXPORT GLOBAL ====================

window.db = db;
window.getCurrentUser = getCurrentUser;
window.getMyProfile = getMyProfile;
window.getMyListings = getMyListings;
window.getSellerListings = getSellerListings;
window.countByCategory = countByCategory;
window.getListingsByCategory = getListingsByCategory;
window.getAllListings = getAllListings;
window.searchListings = searchListings;
window.getFavoriteListings = getFavoriteListings;