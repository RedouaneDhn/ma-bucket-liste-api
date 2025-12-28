// ============================================
// CLOUDINARY SHARE HELPER - VERSION CORRIGÉE
// Génération de collages avec overlays multiples
// ============================================

const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary (depuis variables d'environnement)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration des formats par réseau social
const SOCIAL_FORMATS = {
  instagram: {
    width: 1080,
    height: 1080,
    name: 'Instagram Post',
    maxImages: 9,
    headerHeight: 70,
    footerHeight: 90,
    showDestinations: true
  },
  facebook: {
    width: 1200,
    height: 630,
    name: 'Facebook',
    maxImages: 6,
    headerHeight: 60,
    footerHeight: 70,
    showDestinations: false
  },
  twitter: {
    width: 1200,
    height: 675,
    name: 'Twitter',
    maxImages: 6,
    headerHeight: 60,
    footerHeight: 70,
    showDestinations: false
  },
  stories: {
    width: 1080,
    height: 1920,
    name: 'Instagram Stories',
    maxImages: 6,
    headerHeight: 80,
    footerHeight: 100,
    showDestinations: false
  }
};

// Configuration du logo
const LOGO_CONFIG = {
  publicId: 'logo_xdetr5',
  width: 250,
  position: 'top_right',
  margin: 20,
  opacity: 95
};

// Configuration des couleurs et styles
const STYLE_CONFIG = {
  headerBg: 'rgb:000000',
  headerOpacity: 70,
  footerBg: 'rgb:000000',
  footerOpacity: 70,
  textColor: 'rgb:ffffff',
  primaryFont: 'Montserrat',
  secondaryFont: 'Arial'
};

console.log('✅ Cloudinary Share Helper chargé - Version avec overlays séparés');

// ============================================
// FONCTION: calculateGridLayout
// ============================================
function calculateGridLayout(imageCount, formatKey) {
  const format = SOCIAL_FORMATS[formatKey];
  const { width, height, headerHeight, footerHeight } = format;
  
  const availableHeight = height - headerHeight - footerHeight;
  const availableWidth = width;
  const gap = 10;
  
  console.log(`[LAYOUT] Format: ${formatKey}, Images: ${imageCount}, Zone: ${availableWidth}x${availableHeight}`);
  
  let rows, cols;
  
  switch (imageCount) {
    case 1:
      rows = 1; cols = 1;
      break;
    case 2:
      rows = (formatKey === 'stories') ? 2 : 1;
      cols = (formatKey === 'stories') ? 1 : 2;
      break;
    case 3:
      rows = (formatKey === 'stories') ? 3 : 1;
      cols = (formatKey === 'stories') ? 1 : 3;
      break;
    case 4:
      rows = 2; cols = 2;
      break;
    case 5:
    case 6:
      rows = 2; cols = 3;
      break;
    case 7:
    case 8:
    case 9:
      rows = 3; cols = 3;
      break;
    default:
      rows = 3; cols = 3;
  }
  
  const imageWidth = Math.floor((availableWidth - (cols - 1) * gap) / cols);
  const imageHeight = Math.floor((availableHeight - (rows - 1) * gap) / rows);
  
  const positions = [];
  const numImages = Math.min(imageCount, rows * cols);
  
  for (let i = 0; i < numImages; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const x = col * (imageWidth + gap);
    const y = headerHeight + row * (imageHeight + gap);
    
    positions.push({
      x,
      y,
      width: imageWidth,
      height: imageHeight
    });
  }
  
  console.log(`[LAYOUT] Grille: ${rows}x${cols}, Taille cellule: ${imageWidth}x${imageHeight}`);
  
  return positions;
}

// ============================================
// FONCTION: buildHeaderOverlay
// ============================================
function buildHeaderOverlay(formatKey) {
  const format = SOCIAL_FORMATS[formatKey];
  const overlays = [];
  
  console.log(`🔍 [DEBUG LOGO] publicId: ${LOGO_CONFIG.publicId}`);
  
  let logoX, logoY, logoGravity;
  
  switch (LOGO_CONFIG.position) {
    case 'top_right':
      logoGravity = 'north_east';
      logoX = LOGO_CONFIG.margin;
      logoY = LOGO_CONFIG.margin;
      break;
    case 'top_left':
      logoGravity = 'north_west';
      logoX = LOGO_CONFIG.margin;
      logoY = LOGO_CONFIG.margin;
      break;
    case 'center':
      logoGravity = 'center';
      logoX = 0;
      logoY = -(format.height / 2) + (format.headerHeight / 2);
      break;
    default:
      logoGravity = 'north_east';
      logoX = LOGO_CONFIG.margin;
      logoY = LOGO_CONFIG.margin;
  }
  
  overlays.push({
    overlay: LOGO_CONFIG.publicId,
    width: LOGO_CONFIG.width,
    crop: 'scale',
    opacity: LOGO_CONFIG.opacity
  });
  
  overlays.push({
    flags: 'layer_apply',
    gravity: logoGravity,
    x: logoX,
    y: logoY
  });
  
  console.log(`[HEADER] Logo ajouté - Position: ${LOGO_CONFIG.position}, Taille: ${LOGO_CONFIG.width}px`);
  
  return overlays;
}

// ============================================
// FONCTION: buildFooterOverlay
// ============================================
function buildFooterOverlay(formatKey, stats, destinationNames) {
  const format = SOCIAL_FORMATS[formatKey];
  const overlays = [];
  
  const completedCount = stats.completed || 0;
  const totalCount = stats.total || 0;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const statsText = `✅ ${completedCount}/${totalCount} réalisées (${percentage}%)`;
  
  overlays.push({
    overlay: {
      font_family: STYLE_CONFIG.primaryFont,
      font_size: 36,
      font_weight: 'black',
      text: encodeURIComponent(statsText)
    },
    color: STYLE_CONFIG.textColor
  });
  
  overlays.push({
    flags: 'layer_apply',
    gravity: 'south_west',
    x: 30,
    y: format.showDestinations ? 55 : 25
  });
  
  if (format.showDestinations && destinationNames && destinationNames.length > 0) {
    const displayNames = destinationNames.slice(0, 5);
    const destinationsText = `🌍 ${displayNames.join(' • ')}${destinationNames.length > 5 ? '...' : ''}`;
    
    overlays.push({
      overlay: {
        font_family: STYLE_CONFIG.primaryFont,
        font_size: 24,
        text: encodeURIComponent(destinationsText)
      },
      color: STYLE_CONFIG.textColor
    });
    
    overlays.push({
      flags: 'layer_apply',
      gravity: 'south_west',
      x: 30,
      y: 30
    });
  }
  
  const ctaText = 'mabucketliste.fr';
  
  overlays.push({
    overlay: {
      font_family: STYLE_CONFIG.primaryFont,
      font_size: 32,
      font_weight: 'black',
      text: ctaText
    },
    color: STYLE_CONFIG.textColor
  });
  
  overlays.push({
    flags: 'layer_apply',
    gravity: 'south_east',
    x: 30,
    y: format.showDestinations ? 30 : 25
  });
  
  console.log(`[FOOTER] Stats: ${statsText}, Destinations: ${format.showDestinations}, CTA: ${ctaText}`);
  
  return overlays;
}

// ============================================
// FONCTION: buildOverlayTransformations
// ============================================
function buildOverlayTransformations(images, positions, formatKey, stats, destinationNames) {
  const allOverlays = [];
  
  console.log(`[OVERLAYS] Construction de ${images.length} images + header + footer`);
  
  images.forEach((publicId, index) => {
    const pos = positions[index];
    
    console.log(`🔍 [DEBUG] publicId original: ${publicId}`);
    
    if (!pos) {
      console.warn(`[OVERLAYS] Position manquante pour l'image ${index}`);
      return;
    }
    
    allOverlays.push({
      overlay: publicId,
      width: pos.width,
      height: pos.height,
      crop: 'fill',
      gravity: 'auto'
    });
    
    allOverlays.push({
      flags: 'layer_apply',
      gravity: 'north_west',
      x: pos.x,
      y: pos.y
    });
  });
  
  const headerOverlays = buildHeaderOverlay(formatKey);
  allOverlays.push(...headerOverlays);
  
  const footerOverlays = buildFooterOverlay(formatKey, stats, destinationNames);
  allOverlays.push(...footerOverlays);
  
  console.log(`[OVERLAYS] Total: ${allOverlays.length} overlays créés`);
  
  return allOverlays;
}

// ============================================
// FONCTION PRINCIPALE: generateShareData
// ============================================
async function generateShareData(bucketListItems, stats, userId) {
  try {
    console.log('🎨 [SHARE] Début génération collages pour user:', userId);
    console.log(`📊 Stats: ${stats.completed}/${stats.total} activités`);

    const imagesToUse = [];
    const destinationsToUse = [];
    
    bucketListItems.forEach((item, itemIndex) => {
      console.log(`\n[${itemIndex}] Validation: "${item.title}"`);
      console.log(`    cloudinary_public_id: "${item.cloudinary_public_id}"`);
      console.log(`    type: ${typeof item.cloudinary_public_id}`);
      
      if (!item.cloudinary_public_id) {
        console.log(`    ❌ REJETÉ: Pas de cloudinary_public_id`);
        return;
      }
      
      let publicId = String(item.cloudinary_public_id).trim();
      
      if (publicId.length === 0 || 
          publicId === 'undefined' || 
          publicId === 'null' ||
          publicId === 'NaN') {
        console.log(`    ❌ REJETÉ: Valeur invalide: "${publicId}"`);
        return;
      }
      
      const validFormat = /^[a-zA-Z0-9_\-\/\.]+$/;
      
      if (!validFormat.test(publicId)) {
        console.log(`    ❌ REJETÉ: Format invalide`);
        return;
      }
      
      imagesToUse.push(publicId);
      
      if (item.destination_name) {
        destinationsToUse.push(item.destination_name);
      }
      
      console.log(`    ✅ ACCEPTÉ`);
    });

    if (imagesToUse.length === 0) {
      console.error('❌ Aucune image valide trouvée après validation');
      throw new Error('Aucune image valide dans la bucket list');
    }

    console.log(`📊 ${imagesToUse.length} images validées sur ${bucketListItems.length} activités`);
    
    const startTime = Date.now();
    const backgroundPublicId = 'purple-gradient_iaa2rn';

    const generationPromises = Object.entries(SOCIAL_FORMATS).map(async ([formatKey, formatConfig]) => {
      try {
        console.log(`[${formatKey.toUpperCase()}] Génération avec Cloudinary explicit...`);
        
        const limitedImages = imagesToUse.slice(0, formatConfig.maxImages);
        const positions = calculateGridLayout(limitedImages.length, formatKey);
        
        const overlays = buildOverlayTransformations(
          limitedImages,
          positions,
          formatKey,
          stats,
          destinationsToUse
        );
        
        const transformation = [
          {
            width: formatConfig.width,
            height: formatConfig.height,
            crop: 'fill',
            background: 'white'
          },
          ...overlays
        ];
        
        const explicitResult = await cloudinary.uploader.explicit(
          backgroundPublicId,
          {
            type: 'upload',
            resource_type: 'image',
            eager: [
              {
                transformation: transformation,
                format: 'jpg',
                quality: 'auto:good'
              }
            ]
          }
        );
        
        if (explicitResult && explicitResult.eager && explicitResult.eager[0]) {
          const imageUrl = explicitResult.eager[0].secure_url;
          
          console.log(`✅ [${formatKey.toUpperCase()}] Collage généré: ${imageUrl}`);
          console.log(`🔍 [${formatKey.toUpperCase()}] explicitResult:`, JSON.stringify(explicitResult, null, 2));
          
          return {
            formatKey,
            success: true,
            data: {
              imageUrl: imageUrl,
              width: formatConfig.width,
              height: formatConfig.height,
              format: formatConfig.name
            }
          };
        } else {
          console.error(`❌ [${formatKey.toUpperCase()}] Pas de résultat eager`);
          console.error(`🔍 [${formatKey.toUpperCase()}] explicitResult complet:`, JSON.stringify(explicitResult, null, 2));
          return { formatKey, success: false };
        }
        
      } catch (uploadError) {
        console.error(`❌ [${formatKey.toUpperCase()}] Erreur explicit:`, uploadError.message);
        console.error('Stack:', uploadError.stack);
        return { formatKey, success: false, error: uploadError.message };
      }
    });

    const allResults = await Promise.allSettled(generationPromises);

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`⚡ Génération terminée en ${totalTime}s`);

    const results = {};
    let successCount = 0;

    allResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const { formatKey, data } = result.value;
        results[formatKey] = data;
        successCount++;
      } else if (result.status === 'fulfilled') {
        console.warn(`⚠️ Format ${result.value.formatKey} a échoué`);
      }
    });
    
    console.log(`✅ Génération terminée: ${successCount}/4 images`);
    
    if (successCount === 0) {
      throw new Error('Aucune image n\'a pu être générée');
    }
    
    return {
      success: true,
      images: results,
      stats: stats
    };
    
  } catch (error) {
    console.error('❌ Erreur dans generateShareData:', error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  generateShareData,
  SOCIAL_FORMATS
};