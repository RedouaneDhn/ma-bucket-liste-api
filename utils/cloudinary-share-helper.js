/**
 * Générateur de collages d'images pour partage social
 * Utilise le SDK Cloudinary pour créer des images composites
 */

const cloudinary = require('../config/cloudinary.config');

const CLOUDINARY_CLOUD_NAME = 'dwly55oxx';
const BACKGROUND_IMAGE = 'purple-gradient_iaa2rn';

// Configurations des formats sociaux avec grilles dynamiques
const SOCIAL_FORMATS = {
  instagram: {
    width: 1080,
    height: 1080,
    crop: 'fill',
    grid: { cols: 3, rows: 3, maxImages: 9 },
    format: 'square'
  },
  facebook: {
    width: 1200,
    height: 630,
    crop: 'fill',
    grid: { cols: 4, rows: 2, maxImages: 8 },
    format: 'landscape'
  },
  twitter: {
    width: 1200,
    height: 675,
    crop: 'fill',
    grid: { cols: 4, rows: 2, maxImages: 8 },
    format: 'landscape'
  },
  stories: {
    width: 1080,
    height: 1920,
    crop: 'fill',
    grid: { cols: 3, rows: 5, maxImages: 9 },
    format: 'portrait'
  }
};

// Constantes de mise en page
const LAYOUT = {
  margin: 40,
  spacing: 20
};

/**
 * Calcule les positions des images dans la grille
 * @param {number} imageCount - Nombre d'images à placer
 * @param {object} format - Configuration du format social
 * @returns {Array} Positions calculées pour chaque image
 */
function calculateImagePositions(imageCount, format) {
  const { width, height, grid } = format;
  const { cols, rows, maxImages } = grid;
  
  // Limiter au nombre maximum d'images
  const numImages = Math.min(imageCount, maxImages);
  
  // Calculer les dimensions disponibles
  const availableWidth = width - (2 * LAYOUT.margin) - ((cols - 1) * LAYOUT.spacing);
  const availableHeight = height - (2 * LAYOUT.margin) - ((rows - 1) * LAYOUT.spacing);
  
  // Dimensions de chaque image
  const imageWidth = Math.floor(availableWidth / cols);
  const imageHeight = Math.floor(availableHeight / rows);
  
  const positions = [];
  
  // Générer les positions pour chaque image
  for (let i = 0; i < numImages; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const x = LAYOUT.margin + (col * (imageWidth + LAYOUT.spacing));
    const y = LAYOUT.margin + (row * (imageHeight + LAYOUT.spacing));
    
    positions.push({
      x,
      y,
      width: imageWidth,
      height: imageHeight
    });
  }
  
  return positions;
}

/**
 * Construit les transformations d'overlay pour Cloudinary
 * @param {Array} images - Tableau des public IDs des images
 * @param {Array} positions - Positions calculées pour chaque image
 * @returns {Array} Transformations pour l'API Cloudinary
 */
function buildOverlayTransformations(images, positions) {
  return images.map((publicId, index) => {
    const pos = positions[index];
    
    return {
      overlay: publicId,
      width: pos.width,
      height: pos.height,
      crop: 'fill',
      gravity: 'north_west',
      x: pos.x,
      y: pos.y,
      flags: 'layer_apply'
    };
  });
}

/**
 * Génère une image de collage avec Cloudinary
 * @param {Array} imagePublicIds - Public IDs des images à inclure
 * @param {string} platform - Plateforme sociale (instagram, facebook, etc.)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<object>} URL et métadonnées de l'image générée
 */
async function generateCollageImage(imagePublicIds, platform, userId) {
  try {
    // Validation
    if (!imagePublicIds || imagePublicIds.length === 0) {
      throw new Error('Aucune image fournie pour le collage');
    }
    
    if (!SOCIAL_FORMATS[platform]) {
      throw new Error(`Format ${platform} non supporté`);
    }
    
    const format = SOCIAL_FORMATS[platform];
    const timestamp = Date.now();
    
    // Limiter au nombre maximum d'images
    const images = imagePublicIds.slice(0, format.grid.maxImages);
    
    // Calculer les positions
    const positions = calculateImagePositions(images.length, format);
    
    // Construire les overlays
    const overlays = buildOverlayTransformations(images, positions);
    
    // Construire la transformation complète
    const transformation = [
      // Transformation de base pour le fond
      {
        width: format.width,
        height: format.height,
        crop: format.crop,
        quality: 'auto:good',
        fetch_format: 'auto'
      },
      // Ajouter tous les overlays
      ...overlays
    ];
    
    // Nom du fichier de sortie
    const publicId = `share/user_${userId}_${timestamp}_${platform}`;
    
    console.log(`🎨 Génération collage ${platform}:`, {
      images: images.length,
      dimensions: `${format.width}x${format.height}`,
      publicId
    });
    
    // Générer l'image avec l'API Upload de Cloudinary
    const result = await cloudinary.uploader.upload(
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${BACKGROUND_IMAGE}`,
      {
        public_id: publicId,
        transformation: transformation,
        overwrite: true,
        resource_type: 'image',
        type: 'upload',
        invalidate: true // Invalider le cache CDN
      }
    );
    
    console.log(`✅ Collage ${platform} généré:`, result.secure_url);
    
    return {
      imageUrl: result.secure_url,
      width: format.width,
      height: format.height,
      format: format.format,
      imagesCount: images.length,
      cloudinaryPublicId: result.public_id,
      version: result.version
    };
    
  } catch (error) {
    console.error(`❌ Erreur génération collage ${platform}:`, error.message);
    throw new Error(`Échec génération image ${platform}: ${error.message}`);
  }
}

/**
 * Génère toutes les images de partage social
 * @param {Array} userActivities - Activités de l'utilisateur
 * @param {object} stats - Statistiques de la bucket list
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<object>} Données de partage avec toutes les images
 */
async function generateShareData(userActivities, stats, userId) {
  console.log('🔍 userActivities reçues:', JSON.stringify(userActivities[0], null, 2));

  try {
    // ✅ CORRECTION : Extraire les public IDs de manière robuste
    // Supporter les deux structures possibles :
    // - item.cloudinary_public_id (structure plate)
    // - item.activity.cloudinary_public_id (structure imbriquée)
    const imagePublicIds = userActivities
      .filter(item => {
        return item.cloudinary_public_id || item.activity?.cloudinary_public_id;
      })
      .map(item => {
        // Récupérer le public ID depuis la bonne propriété
        let publicId = item.cloudinary_public_id || item.activity?.cloudinary_public_id;
        
        if (!publicId) return null;
        
        // ✅ CORRECTION CRITIQUE : Ajouter le préfixe du dossier Cloudinary si manquant
        // Les images sont stockées dans ma-bucket-liste/activities/ sur Cloudinary
        // mais les IDs en base de données sont stockés sans ce préfixe
        if (!publicId.includes('/')) {
          publicId = `ma-bucket-liste/activities/${publicId}`;
          console.log(`  📁 Ajout du préfixe: ${item.cloudinary_public_id || item.activity?.cloudinary_public_id} → ${publicId}`);
        }
        
        return publicId;
      })
      .filter(Boolean);
    
    console.log('🖼️ Public IDs extraits (avec préfixe):', imagePublicIds);
    
    if (imagePublicIds.length === 0) {
      throw new Error('Aucune image disponible dans les activités');
    }
    
    console.log(`📸 Génération des images pour ${imagePublicIds.length} activités`);
    
    // Générer les images pour toutes les plateformes en parallèle
    const platforms = ['instagram', 'facebook', 'twitter', 'stories'];
    
    const imagePromises = platforms.map(platform =>
      generateCollageImage(imagePublicIds, platform, userId)
        .then(result => ({ platform, result }))
        .catch(error => ({ platform, error: error.message }))
    );
    
    const results = await Promise.all(imagePromises);
    
    // Construire l'objet de réponse
    const images = {};
    const errors = [];
    
    results.forEach(({ platform, result, error }) => {
      if (error) {
        errors.push({ platform, error });
        console.error(`❌ Erreur ${platform}:`, error);
      } else {
        images[platform] = result;
      }
    });
    
    if (Object.keys(images).length === 0) {
      throw new Error('Échec de génération de toutes les images');
    }
    
    const response = {
      success: true,
      stats: {
        totalActivities: stats.total,
        completedCount: stats.completed,
        pendingCount: stats.pending,
        completionRate: stats.completionRate
      },
      images
    };
    
    if (errors.length > 0) {
      response.partialErrors = errors;
    }
    
    console.log(`✅ Génération terminée: ${Object.keys(images).length}/${platforms.length} images`);
    
    return response;
    
  } catch (error) {
    console.error('❌ Erreur generateShareData:', error.message);
    throw error;
  }
}

/**
 * Nettoie les anciennes images de partage (optionnel)
 * @param {string} userId - ID de l'utilisateur
 * @param {number} daysOld - Nombre de jours avant suppression
 */
async function cleanupOldShareImages(userId, daysOld = 7) {
  try {
    const prefix = `share/user_${userId}_`;
    const cutoffTimestamp = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    // Lister les images du dossier share de l'utilisateur
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: prefix,
      max_results: 500
    });
    
    // Filtrer les images anciennes
    const oldImages = result.resources.filter(resource => {
      const match = resource.public_id.match(/_(\d+)_/);
      if (match) {
        const timestamp = parseInt(match[1], 10);
        return timestamp < cutoffTimestamp;
      }
      return false;
    });
    
    if (oldImages.length > 0) {
      const publicIds = oldImages.map(img => img.public_id);
      await cloudinary.api.delete_resources(publicIds);
      console.log(`🗑️ ${oldImages.length} anciennes images supprimées pour user ${userId}`);
    }
    
  } catch (error) {
    console.error('⚠️ Erreur nettoyage images:', error.message);
    // Ne pas faire échouer la requête principale
  }
}

module.exports = {
  generateShareData,
  generateCollageImage,
  cleanupOldShareImages,
  SOCIAL_FORMATS
};