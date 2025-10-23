/**
 * Cloudinary Share Helper - Version Simple et Fonctionnelle
 * Génère des URLs d'images pour le partage social
 */

const CLOUDINARY_CLOUD_NAME = 'dwiy55oxx';
const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Formats d'images pour chaque plateforme
 */
const SOCIAL_FORMATS = {
  instagram: { width: 1080, height: 1080, crop: 'fill' },
  facebook: { width: 1200, height: 630, crop: 'fill' },
  twitter: { width: 1200, height: 675, crop: 'fill' },
  stories: { width: 1080, height: 1920, crop: 'fill' }
};

/**
 * Image de fallback si aucune image d'activité n'est disponible
 */
const FALLBACK_IMAGE = 'ma-bucket-liste/default-bucket-list';

/**
 * Génère une URL Cloudinary simple avec resize
 * @param {string} publicId - Public ID Cloudinary (ex: "ma-bucket-liste/activities/alhambra-hero")
 * @param {number} width - Largeur cible
 * @param {number} height - Hauteur cible
 * @param {string} crop - Mode de crop ('fill', 'fit', 'scale')
 * @returns {string} URL Cloudinary complète
 */
function generateSimpleImageUrl(publicId, width, height, crop = 'fill') {
  // Nettoyer le publicId (enlever l'extension si présente)
  let cleanPublicId = publicId.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  
  // CORRECTION: Enlever le préfixe "ma-bucket-liste/" si présent
  // Les images sont dans "activities/" directement dans Cloudinary
  cleanPublicId = cleanPublicId.replace(/^ma-bucket-liste\//, '');
  
  // Construction de l'URL avec transformations simples
  const transformations = [
    `w_${width}`,
    `h_${height}`,
    `c_${crop}`,
    'q_auto:good', // Qualité automatique optimisée
    'f_auto'       // Format automatique (WebP si supporté)
  ].join(',');
  
  return `${CLOUDINARY_BASE_URL}/${transformations}/${cleanPublicId}`;
}

/**
 * Génère les URLs pour toutes les plateformes sociales
 * @param {Array} userActivities - Liste des activités de l'utilisateur avec leurs images
 * @returns {Object} URLs pour chaque plateforme
 */
function generateSocialShareImages(userActivities) {
  // Trouver la première activité avec une image
  const activityWithImage = userActivities.find(
    activity => activity.cloudinary_public_id
  );
  
  // Public ID à utiliser (première image ou fallback)
  const publicId = activityWithImage 
    ? activityWithImage.cloudinary_public_id 
    : FALLBACK_IMAGE;
  
  // Générer les URLs pour chaque format
  const images = {};
  
  for (const [platform, specs] of Object.entries(SOCIAL_FORMATS)) {
    images[platform] = {
      imageUrl: generateSimpleImageUrl(publicId, specs.width, specs.height, specs.crop),
      width: specs.width,
      height: specs.height,
      format: platform === 'instagram' ? 'square' : 
              platform === 'stories' ? 'portrait' : 'landscape'
    };
  }
  
  return images;
}

/**
 * Génère une URL avec overlay de texte (optionnel - pour amélioration future)
 * @param {string} publicId - Public ID Cloudinary
 * @param {Object} options - Options de format et texte
 * @returns {string} URL avec overlay
 */
function generateImageWithOverlay(publicId, options = {}) {
  const {
    width = 1080,
    height = 1080,
    title = '',
    stats = ''
  } = options;
  
  const cleanPublicId = publicId.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  
  const transformations = [
    // Base image resize
    `w_${width}`,
    `h_${height}`,
    `c_fill`,
    
    // Optional text overlay (si titre fourni)
    ...(title ? [
      `l_text:Arial_60_bold:${encodeURIComponent(title)}`,
      'co_rgb:FFFFFF',
      'g_south',
      'y_100'
    ] : []),
    
    'q_auto:good',
    'f_auto'
  ].join(',');
  
  return `${CLOUDINARY_BASE_URL}/${transformations}/${cleanPublicId}`;
}

/**
 * Teste si une URL Cloudinary est accessible
 * @param {string} url - URL à tester
 * @returns {Promise<boolean>} true si l'image existe
 */
async function testImageUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Erreur test image:', error);
    return false;
  }
}

/**
 * Point d'entrée principal - génère toutes les images de partage
 * @param {Array} userActivities - Activités de l'utilisateur
 * @param {Object} stats - Statistiques de la bucket list
 * @returns {Object} Toutes les données de partage
 */
function generateShareData(userActivities, stats) {
  const images = generateSocialShareImages(userActivities);
  
  return {
    success: true,
    stats: {
      totalActivities: stats.total || 0,
      completedCount: stats.completed || 0,
      pendingCount: stats.pending || 0,
      completionRate: stats.completionRate || 0
    },
    images
  };
}

module.exports = {
  generateSocialShareImages,
  generateSimpleImageUrl,
  generateImageWithOverlay,
  generateShareData,
  testImageUrl,
  SOCIAL_FORMATS
};