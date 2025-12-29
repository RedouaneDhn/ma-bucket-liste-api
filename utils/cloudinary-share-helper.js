// ============================================
// CLOUDINARY SHARE HELPER - VERSION INITIALE
// Celle qui fonctionnait avec 3 activités
// ============================================

const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration des formats
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

const LOGO_CONFIG = {
  publicId: 'logo_xdetr5',
  width: 250,
  position: 'top_right',
  margin: 20,
  opacity: 95
};

const STYLE_CONFIG = {
  headerBg: 'rgb:000000',
  headerOpacity: 70,
  footerBg: 'rgb:000000',
  footerOpacity: 70,
  textColor: 'rgb:ffffff',
  primaryFont: 'Montserrat',
  secondaryFont: 'Arial'
};

console.log('✅ Cloudinary Share Helper chargé - Version initiale');

// Calcul de la grille
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
      rows = (formatKey === 'stories') ? 5 : 2;
      cols = (formatKey === 'stories') ? 1 : 3;
      break;
    case 6:
      rows = (formatKey === 'stories') ? 3 : 2;
      cols = (formatKey === 'stories') ? 2 : 3;
      break;
    case 7:
    case 8:
      rows = (formatKey === 'stories') ? 4 : 2;
      cols = (formatKey === 'stories') ? 2 : 4;
      break;
    case 9:
    default:
      rows = 3; cols = 3;
  }
  
  const cellWidth = Math.floor((availableWidth - (cols - 1) * gap) / cols);
  const cellHeight = Math.floor((availableHeight - (rows - 1) * gap) / rows);
  
  console.log(`[LAYOUT] Grille: ${rows}x${cols}, Taille cellule: ${cellWidth}x${cellHeight}`);
  
  const positions = [];
  for (let i = 0; i < imageCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    positions.push({
      x: col * (cellWidth + gap),
      y: headerHeight + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight
    });
  }
  
  return positions;
}

// Construction du header
function buildHeaderOverlay(formatKey) {
  const overlays = [];
  
  console.log(`🔍 [DEBUG LOGO] publicId: ${LOGO_CONFIG.publicId}`);
  
  overlays.push({
    overlay: LOGO_CONFIG.publicId,
    width: LOGO_CONFIG.width,
    opacity: LOGO_CONFIG.opacity
  });
  
  overlays.push({
    flags: 'layer_apply',
    gravity: 'north_east',
    x: LOGO_CONFIG.margin,
    y: LOGO_CONFIG.margin
  });
  
  console.log(`[HEADER] Logo ajouté - Position: ${LOGO_CONFIG.position}, Taille: ${LOGO_CONFIG.width}px`);
  
  return overlays;
}

// Construction du footer
function buildFooterOverlay(formatKey, stats, destinationNames) {
  const overlays = [];
  const format = SOCIAL_FORMATS[formatKey];
  
  const completionRate = Math.round((stats.completed / stats.total) * 100);
  const statsText = `✅ ${stats.completed}/${stats.total} réalisées (${completionRate}%)`;
  
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
  
  if (format.showDestinations && destinationNames.length > 0) {
    const uniqueDestinations = [...new Set(destinationNames)];
    const destText = uniqueDestinations.slice(0, 3).join(', ');
    
    overlays.push({
      overlay: {
        font_family: STYLE_CONFIG.primaryFont,
        font_size: 28,
        text: encodeURIComponent(`📍 ${destText}`)
      },
      color: STYLE_CONFIG.textColor
    });
    
    overlays.push({
      flags: 'layer_apply',
      gravity: 'south_west',
      x: 30,
      y: 25
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

// Construction des overlays
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
    
    // Overlay de l'image
    allOverlays.push({
      overlay: publicId,
      width: pos.width,
      height: pos.height,
      crop: 'fill',
      gravity: 'auto'
    });
    
    // Application avec positionnement
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

// FONCTION PRINCIPALE
async function generateShareData(bucketListItems, stats, userId) {
  try {
    console.log('🎨 [SHARE] Début génération collages pour user:', userId);
    console.log(`📊 Stats: ${stats.completed}/${stats.total} activités`);

    const imagesToUse = [];
    const destinationsToUse = [];
    
    // VALIDATION DES IMAGES - VERSION INITIALE
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
      
      // ✅ PAS DE PRÉFIXE AJOUTÉ - On utilise le publicId tel quel
      imagesToUse.push(publicId);
      
      if (item.destination_name) {
        destinationsToUse.push(item.destination_name);
      }
      
      console.log(`    ✅ ACCEPTÉ: ${publicId}`);
    });

    if (imagesToUse.length === 0) {
      console.error('❌ Aucune image valide trouvée après validation');
      throw new Error('Aucune image valide dans la bucket list');
    }

    console.log(`📊 ${imagesToUse.length} images validées sur ${bucketListItems.length} activités`);

    const backgroundPublicId = 'purple-gradient_iaa2rn';
    const results = {};
    const generationPromises = Object.entries(SOCIAL_FORMATS).map(async ([formatKey, formatConfig]) => {
      try {
        console.log(`[${formatKey.toUpperCase()}] Génération avec Cloudinary explicit...`);
        
        const maxImages = formatConfig.maxImages;
        const limitedImages = imagesToUse.slice(0, maxImages);
        const positions = calculateGridLayout(limitedImages.length, formatKey);
        const overlays = buildOverlayTransformations(
          limitedImages,
          positions,
          formatKey,
          stats,
          destinationsToUse
        );

        const transformation = [
          { background: 'white' },
          { width: formatConfig.width, height: formatConfig.height, crop: 'fill' },
          ...overlays,
          { quality: 'auto:good' },
          { format: 'jpg' }
        ];

        const explicitResult = await cloudinary.uploader.explicit(
          backgroundPublicId,
          {
            type: 'upload',
            resource_type: 'image',
            eager: [{ transformation }]
          }
        );

        const imageUrl = explicitResult.eager?.[0]?.secure_url;
        
        if (!imageUrl) {
          console.log(`🔍 [${formatKey.toUpperCase()}] explicitResult:`, JSON.stringify(explicitResult, null, 2));
          throw new Error(`Pas d'URL générée pour ${formatKey}`);
        }

        console.log(`✅ [${formatKey.toUpperCase()}] Collage généré: ${imageUrl}`);
        results[formatKey] = imageUrl;

      } catch (error) {
        console.error(`❌ [${formatKey.toUpperCase()}] Erreur explicit:`, error.message);
        console.error('Stack:', error.stack);
        throw error;
      }
    });

    const startTime = Date.now();
    await Promise.all(generationPromises);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`⚡ Génération terminée en ${duration}s`);
    
    const successCount = Object.keys(results).length;
    console.log(`✅ Génération terminée: ${successCount}/4 images`);

    if (successCount === 0) {
      throw new Error('Aucune image n\'a pu être générée');
    }

    return {
      instagram: results.instagram || null,
      facebook: results.facebook || null,
      twitter: results.twitter || null,
      stories: results.stories || null,
      stats: {
        total: stats.total,
        completed: stats.completed,
        pending: stats.total - stats.completed,
        completionRate: Math.round((stats.completed / stats.total) * 100)
      }
    };

  } catch (error) {
    console.error('❌ Erreur dans generateShareData:', error);
    throw error;
  }
}

module.exports = { generateShareData };