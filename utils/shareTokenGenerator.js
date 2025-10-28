/**
 * @fileoverview Générateur de tokens uniques pour les liens de partage social
 * @module utils/shareTokenGenerator
 */

const crypto = require('crypto');

/**
 * Caractères autorisés pour les tokens (Base62: A-Z, a-z, 0-9)
 */
const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 8;
const MAX_GENERATION_ATTEMPTS = 10;

/**
 * Génère un token aléatoire de 8 caractères alphanumériques
 * Utilise crypto.randomBytes() pour garantir la sécurité cryptographique
 * 
 * @returns {string} Token de 8 caractères (A-Za-z0-9)
 * 
 * @example
 * const token = generateShareToken();
 * // Retourne: "aB3xY9mK"
 */
function generateShareToken() {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = '';
  
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    // Utilise modulo pour mapper les bytes sur l'ensemble de caractères
    token += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
  }
  
  return token;
}

/**
 * Vérifie si un token existe déjà dans la base de données
 * 
 * @param {Object} supabase - Instance du client Supabase
 * @param {string} token - Token à vérifier
 * @returns {Promise<boolean>} true si le token existe déjà, false sinon
 */
async function tokenExists(supabase, token) {
  const { data, error } = await supabase
    .from('share_links')
    .select('share_token')
    .eq('share_token', token)
    .single();
  
  // Si on a une erreur PGRST116, c'est que le token n'existe pas (pas trouvé)
  if (error && error.code === 'PGRST116') {
    return false;
  }
  
  // Si on a une autre erreur, on la propage
  if (error) {
    throw error;
  }
  
  // Si on a des données, le token existe
  return !!data;
}

/**
 * Génère un token unique en vérifiant son inexistence dans la base de données
 * Effectue plusieurs tentatives si nécessaire pour garantir l'unicité
 * 
 * @param {Object} supabase - Instance du client Supabase
 * @param {number} [maxAttempts=10] - Nombre maximum de tentatives
 * @returns {Promise<string>} Token unique vérifié
 * @throws {Error} Si impossible de générer un token unique après maxAttempts tentatives
 * 
 * @example
 * const token = await generateUniqueShareToken(supabase);
 * console.log(token); // "aB3xY9mK"
 */
async function generateUniqueShareToken(supabase, maxAttempts = MAX_GENERATION_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = generateShareToken();
    
    try {
      const exists = await tokenExists(supabase, token);
      
      if (!exists) {
        console.log(`✅ Token unique généré: ${token} (tentative ${attempt}/${maxAttempts})`);
        return token;
      }
      
      console.log(`⚠️ Token ${token} existe déjà, nouvelle tentative... (${attempt}/${maxAttempts})`);
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification du token ${token}:`, error);
      throw error;
    }
  }
  
  throw new Error(
    `Impossible de générer un token unique après ${maxAttempts} tentatives. ` +
    `Cela peut indiquer un problème de saturation de l'espace de tokens.`
  );
}

/**
 * Calcule la date d'expiration à partir de maintenant
 * 
 * @param {number} [daysFromNow=30] - Nombre de jours avant expiration
 * @returns {Date} Date d'expiration calculée
 * 
 * @example
 * const expiresAt = getExpirationDate(30);
 * // Retourne la date actuelle + 30 jours
 */
function getExpirationDate(daysFromNow = 30) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + daysFromNow);
  return expirationDate;
}

/**
 * Génère un objet complet de données pour la création d'un lien de partage
 * 
 * @param {Object} supabase - Instance du client Supabase
 * @param {string} userId - ID de l'utilisateur
 * @param {string} platform - Plateforme de partage (facebook, twitter, etc.)
 * @param {string} imageUrl - URL de l'image Cloudinary
 * @param {Object} stats - Statistiques de la bucket list
 * @returns {Promise<Object>} Objet prêt à être inséré en base de données
 * 
 * @example
 * const shareData = await generateShareLinkData(
 *   supabase,
 *   'user-uuid',
 *   'facebook',
 *   'https://res.cloudinary.com/.../image.jpg',
 *   { totalActivities: 5, completedCount: 2, pendingCount: 3, completionRate: 40 }
 * );
 */
async function generateShareLinkData(supabase, userId, platform, imageUrl, stats) {
  const token = await generateUniqueShareToken(supabase);
  const expiresAt = getExpirationDate(30);
  
  return {
    share_token: token,
    user_id: userId,
    platform,
    image_url: imageUrl,
    stats,
    expires_at: expiresAt.toISOString(),
    is_active: true,
    views_count: 0,
    clicks_count: 0
  };
}

module.exports = {
  generateShareToken,
  generateUniqueShareToken,
  getExpirationDate,
  generateShareLinkData,
  tokenExists
};