/**
 * @fileoverview Client Supabase avec Service Role Key
 * Utilisé pour les opérations qui nécessitent de bypass RLS :
 * - Endpoints publics (partage social)
 * - Opérations admin
 * - Analytics
 * 
 * ⚠️ ATTENTION : Ne JAMAIS exposer ce client côté frontend !
 */

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ Variables d\'environnement Supabase manquantes (SERVICE_ROLE_KEY)');
}

const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

console.log('✅ Client Supabase Service (bypass RLS) initialisé');

module.exports = { supabaseService };

// Test automatique au démarrage
supabaseService
  .from('share_links')
  .select('count')
  .limit(1)
  .then(({ error }) => {
    if (error) {
      console.error('❌ Client Service Supabase : Erreur de connexion', error.message);
    } else {
      console.log('✅ Client Service Supabase : Connexion OK (RLS bypass activé)');
    }
  });