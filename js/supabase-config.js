/* ============================================= */
/*   DEKONme — supabase-config.js                */
/*   Client Supabase (CDN SAFE VERSION)          */
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

// 🔹 Annonces utilisateur
async function getMyListings() {
  try {
    if (!db) return [];

    const { data: { user } } = await db.auth.getUser();
    if (!user) return [];

    const { data, error } = await db
      .from('listings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur mes annonces :', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error("Erreur getMyListings :", error);
    return [];
  }
}

// ==================== EXPORT GLOBAL ====================

window.db = db;
window.getCurrentUser = getCurrentUser;
window.getMyProfile = getMyProfile;
window.getMyListings = getMyListings;