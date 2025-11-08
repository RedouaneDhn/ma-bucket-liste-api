// ============================================
// CLOUDINARY SHARE HELPER - VERSION AMÉLIORÉE
// Génération de collages avec branding
// ============================================

const cloudinary = require('cloudinary').v2;

// Configuration des formats par réseau social
const SOCIAL_FORMATS = {
  instagram: {
    width: 1080,
    height: 1080,
    name: 'Instagram Post',
    maxImages: 9,
    headerHeight: 70,
    footerHeight: 90,
    showDestinations: true // Afficher les noms des destinations
  },
  facebook: {
    width: 1200,
    height: 630,
    name: 'Facebook',
    maxImages: 6,
    headerHeight: 60,
    footerHeight: 70,
    showDestinations: false // Footer condensé
  },
  twitter: {
    width: 1200,
    height: 675,
    name: 'Twitter',
    maxImages: 6,
    headerHeight: 60,
    footerHeight: 70,
    showDestinations: false // Footer condensé
  },
  stories: {
    width: 1080,
    height: 1920,
    name: 'Instagram Stories',
    maxImages: 6,
    headerHeight: 80,
    footerHeight: 100,
    showDestinations: false // Stories plus épuré
  }
};

// Configuration du logo
const LOGO_CONFIG = {
  publicId: 'ma-bucket-liste/logo_xdetr5', // Format Cloudinary avec :
  width: 120,
  position: 'top_right', // coin supérieur droit
  margin: 20,
  opacity: 85 // 85% opacité (légèrement transparent)
};

// Configuration des couleurs et styles
const STYLE_CONFIG = {
  headerBg: 'rgb:000000',
  headerOpacity: 70,
  footerBg: 'rgb:000000',
  footerOpacity: 70,
  textColor: 'rgb:ffffff',
  primaryFont: 'Montserrat', // Police moderne
  secondaryFont: 'Arial' // Fallback
};

console.log('✅ Cloudinary Share Helper chargé avec configuration hybride intelligente');

// ============================================
// FONCTION: calculateGridLayout
// Calcule les positions optimales des images
// ============================================
function calculateGridLayout(imageCount, formatKey) {
  const format = SOCIAL_FORMATS[formatKey];
  const { width, height, headerHeight, footerHeight } = format;
  
  // Zone disponible pour les photos (en retirant header et footer)
  const availableHeight = height - headerHeight - footerHeight;
  const availableWidth = width;
  
  // Espacement entre les images (gap)
  const gap = 10;
  
  console.log(`[LAYOUT] Format: ${formatKey}, Images: ${imageCount}, Zone: ${availableWidth}x${availableHeight}`);
  
  // Déterminer la configuration de grille optimale
  let rows, cols;
  
  switch (imageCount) {
    case 1:
      rows = 1; cols = 1;
      break;
    case 2:
      // 1x2 (côte à côte) pour carré/paysage, 2x1 (vertical) pour stories
      rows = (formatKey === 'stories') ? 2 : 1;
      cols = (formatKey === 'stories') ? 1 : 2;
      break;
    case 3:
      // 1x3 pour paysage, 3x1 pour stories, 2x2 (avec 1 vide) pour carré
      if (formatKey === 'stories') {
        rows = 3; cols = 1;
      } else if (formatKey === 'instagram') {
        rows = 2; cols = 2; // On utilisera que 3 emplacements sur 4
      } else {
        rows = 1; cols = 3;
      }
      break;
    case 4:
      rows = 2; cols = 2; // Grille 2x2 parfaite
      break;
    case 5:
      // 2x3 en utilisant 5 emplacements
      rows = 2; cols = 3;
      break;
    case 6:
      rows = 2; cols = 3; // Grille 2x3 ou 3x2 selon format
      if (formatKey === 'stories') {
        rows = 3; cols = 2;
      }
      break;
    case 7:
    case 8:
      rows = 2; cols = 4; // 2x4
      break;
    case 9:
      rows = 3; cols = 3; // Grille 3x3 parfaite
      break;
    default:
      // Fallback pour plus de 9 images (ne devrait pas arriver)
      rows = Math.ceil(Math.sqrt(imageCount));
      cols = Math.ceil(imageCount / rows);
  }
  
  // Calculer la taille de chaque cellule
  const cellWidth = Math.floor((availableWidth - (cols - 1) * gap) / cols);
  const cellHeight = Math.floor((availableHeight - (rows - 1) * gap) / rows);
  
  console.log(`[LAYOUT] Grille: ${rows}x${cols}, Cellule: ${cellWidth}x${cellHeight}`);
  
  // Générer les positions pour chaque image
  const positions = [];
  let imageIndex = 0;
  
  for (let row = 0; row < rows && imageIndex < imageCount; row++) {
    for (let col = 0; col < cols && imageIndex < imageCount; col++) {
      // Cas spécial pour 3 images en grille 2x2 (layout asymétrique)
      if (imageCount === 3 && rows === 2 && cols === 2) {
        if (imageIndex === 0) {
          // Première image : toute la hauteur à gauche
          positions.push({
            x: 0,
            y: headerHeight,
            width: cellWidth,
            height: availableHeight
          });
        } else {
          // 2 images empilées à droite
          positions.push({
            x: cellWidth + gap,
            y: headerHeight + (imageIndex - 1) * (cellHeight + gap),
            width: cellWidth,
            height: cellHeight
          });
        }
      } else {
        // Layout standard en grille
        positions.push({
          x: col * (cellWidth + gap),
          y: headerHeight + row * (cellHeight + gap),
          width: cellWidth,
          height: cellHeight
        });
      }
      
      imageIndex++;
    }
  }
  
  return positions;
}

// ============================================
// FONCTION: buildHeaderOverlay
// Ajoute le logo dans le coin supérieur droit
// ============================================
function buildHeaderOverlay(formatKey) {
  const format = SOCIAL_FORMATS[formatKey];
  const overlays = [];
  
    const logoOverlayId = LOGO_CONFIG.publicId.replace(/\//g, ':');
    console.log(`🔍 [DEBUG LOGO] publicId original: ${LOGO_CONFIG.publicId}`);
console.log(`🔍 [DEBUG LOGO] logoOverlayId converti: ${logoOverlayId}`);

  // Overlay du logo (SVG transparent)
 overlays.push({
  overlay: logoOverlayId,  // ✅ Utiliser logoOverlayId au lieu de LOGO_CONFIG.publicId
  width: LOGO_CONFIG.width,
  gravity: 'north_east',
  x: LOGO_CONFIG.margin,
  y: LOGO_CONFIG.margin,
  opacity: LOGO_CONFIG.opacity,
  flags: 'layer_apply'
});
  
  console.log(`[HEADER] Logo ajouté - Position: top_right, Taille: ${LOGO_CONFIG.width}px`);
  
  return overlays;
}

// ============================================
// FONCTION: buildFooterOverlay
// Ajoute les stats, destinations et CTA en footer
// ============================================
function buildFooterOverlay(formatKey, stats, destinationNames) {
  const format = SOCIAL_FORMATS[formatKey];
  const overlays = [];
  
  // Calculer le taux de complétion
  const completionRate = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;
  
  // Ligne 1: Stats de réalisation
  const statsText = `✅ ${stats.completed}/${stats.total} réalisées (${completionRate}%)`;
  
  // Position Y du footer (en bas de l'image)
  const footerY = format.height - format.footerHeight;
  
  // Fond semi-transparent pour le footer
  overlays.push({
    overlay: {
      type: 'rectangle',
      width: format.width,
      height: format.footerHeight,
      fill: STYLE_CONFIG.footerBg
    },
    opacity: STYLE_CONFIG.footerOpacity,
    gravity: 'south_west',
    y: 0,
    flags: 'layer_apply'
  });
  
  // Ligne 1: Stats (toujours affiché)
  overlays.push({
    overlay: {
      font_family: STYLE_CONFIG.primaryFont,
      font_size: 32,
      font_weight: 'bold',
      text: encodeURIComponent(statsText)
    },
    gravity: 'south_west',
    x: 30,
    y: format.showDestinations ? 55 : 25, // Position selon si on affiche les destinations
    color: STYLE_CONFIG.textColor,
    flags: 'layer_apply'
  });
  
  // Ligne 2: Noms des destinations (seulement si activé pour ce format)
  if (format.showDestinations && destinationNames && destinationNames.length > 0) {
    // Limiter à 5 destinations max pour éviter le débordement
    const displayNames = destinationNames.slice(0, 5);
    const destinationsText = `🌍 ${displayNames.join(' • ')}${destinationNames.length > 5 ? '...' : ''}`;
    
    overlays.push({
      overlay: {
        font_family: STYLE_CONFIG.primaryFont,
        font_size: 24,
        text: encodeURIComponent(destinationsText)
      },
      gravity: 'south_west',
      x: 30,
      y: 30,
      color: STYLE_CONFIG.textColor,
      flags: 'layer_apply'
    });
  }
  
  // Ligne 3: CTA (toujours en dernier)
  const ctaText = 'mabucketliste.fr';
  overlays.push({
    overlay: {
      font_family: STYLE_CONFIG.primaryFont,
      font_size: 24,
      font_weight: 'bold',
      text: ctaText
    },
    gravity: 'south_east',
    x: 30,
    y: format.showDestinations ? 30 : 25,
    color: STYLE_CONFIG.textColor,
    flags: 'layer_apply'
  });
  
  console.log(`[FOOTER] Stats: ${statsText}, Destinations: ${format.showDestinations}, CTA: ${ctaText}`);
  
  return overlays;
}

function buildOverlayTransformations(images, positions, formatKey, stats, destinationNames) {
  const allOverlays = [];
  
  console.log(`[OVERLAYS] Construction de ${images.length} images + header + footer`);
  
  // 1. Ajouter les images de la grille
  images.forEach((publicId, index) => {
    const pos = positions[index];
    
    if (!pos) {
      console.warn(`[OVERLAYS] Position manquante pour l'image ${index}`);
      return;
    }
    
    const overlayId = publicId.replace(/\//g, ':');
    console.log(`🔍 [DEBUG] publicId original: ${publicId}`);
    console.log(`🔍 [DEBUG] overlayId converti: ${overlayId}`);
    
    allOverlays.push({
      overlay: overlayId,
      width: pos.width,
      height: pos.height,
      crop: 'fill',
      gravity: 'auto',
      x: pos.x,
      y: pos.y,
      flags: 'layer_apply'
    });
  }); // ← Fermeture du forEach ICI !
  
  // 2. Ajouter le header (logo)
  const headerOverlays = buildHeaderOverlay(formatKey);
  allOverlays.push(...headerOverlays);
  
  // 3. Ajouter le footer (stats + destinations + CTA)
  const footerOverlays = buildFooterOverlay(formatKey, stats, destinationNames);
  allOverlays.push(...footerOverlays);
  
  console.log(`[OVERLAYS] Total: ${allOverlays.length} overlays créés`);
  
  return allOverlays;
}

// ============================================
// FONCTION: generateShareData
// Fonction principale qui génère les 4 collages
// ============================================
async function generateShareData(bucketListItems, stats, userId) {
  try {
    console.log('\n========================================');
    console.log('🚀 GÉNÉRATION DES COLLAGES CLOUDINARY');
    console.log('========================================\n');
    
    console.log(`[SHARE] User ID: ${userId}`);
    console.log(`[SHARE] Nombre d'activités dans la bucket list: ${bucketListItems.length}`);
    
  const validItems = bucketListItems.filter(item => {
  // ✅ CORRECTION : Les données sont déjà aplaties (pas de .activity)
  const hasImage = item.cloudinary_public_id; // Directement à la racine
  if (!hasImage) {
    console.log(`[SHARE] ⚠️  Activité sans image: ${item.title || 'Unknown'}`);
  }
  return hasImage;
});
    
    console.log(`[SHARE] Activités avec images valides: ${validItems.length}`);
    
    if (validItems.length === 0) {
      throw new Error('Aucune activité avec image disponible pour générer le collage');
    }
    
    // 2. Extraire les cloudinary_public_id et ajouter le préfixe si nécessaire
    const imagePublicIds = validItems.map(item => {
  let publicId = item.cloudinary_public_id; // ✅ Pas de .activity
  
   if (!publicId.includes('/')) {
    publicId = `ma-bucket-liste/activities/${publicId}`;
  }
  
  return publicId;
});
    
    console.log(`[SHARE] Images à utiliser: ${imagePublicIds.slice(0, 3).join(', ')}...`);
    
    // 3. Extraire les noms des destinations (pour le footer)
    const destinationNames = validItems.map(item => {
  const title = item.title || 'Activité'; // ✅ Pas de .activity
  return title.length > 15 ? title.substring(0, 15) + '...' : title;
});
    
   
    
    console.log(`[SHARE] Stats: ${stats.completed}/${stats.total} réalisées`);
    
    // 5. Générer les collages pour chaque format
    const results = {};
    
    for (const [formatKey, formatConfig] of Object.entries(SOCIAL_FORMATS)) {
      console.log(`\n--- Format: ${formatConfig.name} (${formatConfig.width}x${formatConfig.height}) ---`);
      
      // Limiter le nombre d'images selon le format
      const maxImages = formatConfig.maxImages;
      const imagesToUse = imagePublicIds.slice(0, maxImages);
      const destinationsToUse = destinationNames.slice(0, maxImages);
      
      console.log(`[${formatKey.toUpperCase()}] Utilisation de ${imagesToUse.length}/${imagePublicIds.length} images (max: ${maxImages})`);
      
      // Calculer le layout optimal
      const positions = calculateGridLayout(imagesToUse.length, formatKey);
      
      // Construire les overlays (images + header + footer)
      const overlays = buildOverlayTransformations(
        imagesToUse, 
        positions, 
        formatKey, 
        stats, 
        destinationsToUse
      );
      
      // Créer l'image de base (fond blanc)
      const transformation = [
        {
          width: formatConfig.width,
          height: formatConfig.height,
          crop: 'fill',
          background: 'white'
        },
        ...overlays
      ];
      
      // Générer l'URL Cloudinary
      const publicId = `ma-bucket-liste/shares/user_${userId}_${formatKey}_${Date.now()}`;
      
      try {
        console.log(`[${formatKey.toUpperCase()}] Upload vers Cloudinary...`);
        
        const uploadResult = await cloudinary.uploader.upload(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          {
            public_id: publicId,
            transformation: transformation,
            resource_type: 'image',
            format: 'jpg',
            quality: 'auto:good'
          }
        );
        
        results[formatKey] = {
          url: uploadResult.secure_url,
          width: formatConfig.width,
          height: formatConfig.height,
          imageCount: imagesToUse.length
        };
        
        console.log(`[${formatKey.toUpperCase()}] ✅ Succès: ${uploadResult.secure_url}`);
        
      } catch (uploadError) {
        console.error(`[${formatKey.toUpperCase()}] ❌ Erreur upload:`, uploadError.message);
        results[formatKey] = {
          error: uploadError.message,
          url: null
        };
      }
    }
    
    console.log('\n========================================');
    console.log('✅ GÉNÉRATION TERMINÉE');
    console.log('========================================\n');
    
    return {
      success: true,
      images: results,
      stats: stats
    };
    
  } catch (error) {
    console.error('[SHARE] ❌ Erreur globale:', error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  generateShareData,
  SOCIAL_FORMATS,
  calculateGridLayout,
  buildHeaderOverlay,
  buildFooterOverlay,
  buildOverlayTransformations
};

console.log('📦 Module cloudinary-share-helper exporté avec succès');