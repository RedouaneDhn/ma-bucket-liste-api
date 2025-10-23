/**
 * Cloudinary Share Helper - Version Collage Dynamique
 * Génère des images de partage avec composition multi-images
 */

const CLOUDINARY_CLOUD_NAME = 'dwly55oxx';
const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Image de fond pour le collage
const BACKGROUND_IMAGE = 'backgrounds/purple-gradient_iaa2rn';

/**
 * Formats d'images pour chaque plateforme sociale
 */
const SOCIAL_FORMATS = {
  instagram: { 
    width: 1080, 
    height: 1080, 
    crop: 'fill',
    grid: { cols: 3, rows: 3, maxImages: 9 }
  },
  facebook: { 
    width: 1200, 
    height: 630, 
    crop: 'fill',
    grid: { cols: 4, rows: 2, maxImages: 8 }
  },
  twitter: { 
    width: 1200, 
    height: 675, 
    crop: 'fill',
    grid: { cols: 4, rows: 2, maxImages: 8 }
  },
  stories: { 
    width: 1080, 
    height: 1920, 
    crop: 'fill',
    grid: { cols: 3, rows: 5, maxImages: 9 }
  }
};

/**
 * Nettoie un public ID Cloudinary
 */
function cleanPublicId(publicId) {
  if (!publicId) return null;
  
  // Enlever l'extension
  let cleaned = publicId.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  
  // Enlever le préfixe ma-bucket-liste/ si présent
  cleaned = cleaned.replace(/^ma-bucket-liste\//, '');
  
  return cleaned;
}

/**
 * Extrait les images des activités utilisateur
 */
function extractActivityImages(userActivities) {
  const images = [];
  
  for (const activity of userActivities) {
    // Cas 1: cloudinary_public_id direct sur l'activité
    if (activity.cloudinary_public_id) {
      images.push(cleanPublicId(activity.cloudinary_public_id));
    }
    // Cas 2: activity_images array
    else if (activity.activity_images && Array.isArray(activity.activity_images)) {
      for (const img of activity.activity_images) {
        if (img.cloudinary_public_id) {
          images.push(cleanPublicId(img.cloudinary_public_id));
        }
      }
    }
    // Cas 3: activities.activity_images
    else if (activity.activities?.activity_images) {
      for (const img of activity.activities.activity_images) {
        if (img.cloudinary_public_id) {
          images.push(cleanPublicId(img.cloudinary_public_id));
        }
      }
    }
  }
  
  // Filtrer les nulls et dédupliquer
  return [...new Set(images.filter(Boolean))];
}

/**
 * Calcule les positions pour une grille d'images
 */
function calculateGridPositions(imageCount, format) {
  const { width, height, grid } = format;
  const { cols, rows, maxImages } = grid;
  
  const count = Math.min(imageCount, maxImages);
  
  // Marges et espacement
  const margin = 40;
  const spacing = 20;
  
  // Dimensions disponibles pour la grille
  const availableWidth = width - (2 * margin);
  const availableHeight = height - (2 * margin);
  
  // Dimensions de chaque cellule
  const cellWidth = (availableWidth - (spacing * (cols - 1))) / cols;
  const cellHeight = (availableHeight - (spacing * (rows - 1))) / rows;
  
  const positions = [];
  
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const x = margin + (col * (cellWidth + spacing));
    const y = margin + (row * (cellHeight + spacing));
    
    positions.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(cellWidth),
      height: Math.round(cellHeight)
    });
  }
  
  return positions;
}

/**
 * Génère les transformations Cloudinary pour un overlay d'image
 */
function generateOverlayTransformation(publicId, position) {
  const { x, y, width, height } = position;
  
  return [
    `l_${publicId.replace(/\//g, ':')}`,  // Layer
    `w_${width}`,                          // Width
    `h_${height}`,                         // Height
    'c_fill',                              // Crop mode
    'g_north_west',                        // Gravity (top-left)
    `x_${x}`,                              // X position
    `y_${y}`,                              // Y position
    'fl_layer_apply'                       // Apply layer
  ].join(',');
}

/**
 * Génère une URL de collage pour une plateforme
 */
function generateCollageUrl(images, platform) {
  const format = SOCIAL_FORMATS[platform];
  
  if (!format) {
    throw new Error(`Format inconnu: ${platform}`);
  }
  
  // Limiter aux N premières images selon la plateforme
  const limitedImages = images.slice(0, format.grid.maxImages);
  
  if (limitedImages.length === 0) {
    // Pas d'images : retourner juste le fond
    return `${CLOUDINARY_BASE_URL}/w_${format.width},h_${format.height},c_fill,q_auto:good,f_auto/${BACKGROUND_IMAGE}`;
  }
  
  // Calculer les positions
  const positions = calculateGridPositions(limitedImages.length, format);
  
  // Construire la transformation de base
  const baseTransform = [
    `w_${format.width}`,
    `h_${format.height}`,
    'c_fill',
    'q_auto:good',
    'f_auto'
  ].join(',');
  
  // Construire les overlays
  const overlays = [];
  for (let i = 0; i < limitedImages.length; i++) {
    overlays.push(generateOverlayTransformation(limitedImages[i], positions[i]));
  }
  
  // URL finale : base + overlays séparés par /
  const allTransforms = [baseTransform, ...overlays].join('/');
  return `${CLOUDINARY_BASE_URL}/${allTransforms}/${BACKGROUND_IMAGE}`;
}

/**
 * Génère les URLs pour toutes les plateformes sociales
 */
function generateSocialShareImages(userActivities) {
  // Extraire toutes les images des activités
  const images = extractActivityImages(userActivities);
  
  console.log(`[CLOUDINARY] ${images.length} images trouvées pour le collage`);
  
  // Générer les URLs pour chaque plateforme
  const result = {};
  
  for (const [platform, format] of Object.entries(SOCIAL_FORMATS)) {
    result[platform] = {
      imageUrl: generateCollageUrl(images, platform),
      width: format.width,
      height: format.height,
      format: platform === 'instagram' ? 'square' : 
              platform === 'stories' ? 'portrait' : 'landscape',
      imagesCount: Math.min(images.length, format.grid.maxImages)
    };
  }
  
  return result;
}

/**
 * Génère une URL simple (sans collage) pour une seule image
 */
function generateSimpleImageUrl(publicId, width, height, crop = 'fill') {
  const cleanId = cleanPublicId(publicId);
  
  if (!cleanId) {
    return `${CLOUDINARY_BASE_URL}/w_${width},h_${height},c_${crop},q_auto:good,f_auto/${BACKGROUND_IMAGE}`;
  }
  
  const transformations = [
    `w_${width}`,
    `h_${height}`,
    `c_${crop}`,
    'q_auto:good',
    'f_auto'
  ].join(',');
  
  return `${CLOUDINARY_BASE_URL}/${transformations}/${cleanId}`;
}

/**
 * Point d'entrée principal
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
  generateShareData,
  generateSocialShareImages,
  generateSimpleImageUrl,
  SOCIAL_FORMATS,
  CLOUDINARY_CLOUD_NAME
};