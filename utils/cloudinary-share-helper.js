/**
 * Cloudinary Social Share Image Generator
 * Génère des images dynamiques pour le partage social avec grid d'activités
 */

const CLOUDINARY_CONFIG = {
  cloudName: 'dwiy55oxx',
  logoPath: 'ma-bucket-liste/logo_xdetr5',
  activitiesPath: 'ma-bucket-liste/activities',
  fallbackImage: 'ma-bucket-liste/default-activity' // Image par défaut si hero manquante
};

const FORMATS = {
  instagram: { width: 1080, height: 1080, name: 'square' },
  facebook: { width: 1200, height: 630, name: 'rectangle' },
  twitter: { width: 1200, height: 630, name: 'rectangle' },
  stories: { width: 1080, height: 1920, name: 'vertical' }
};

/**
 * Calcule le texte engageant selon le ratio d'activités réalisées
 */
function getEngagingText(completedCount, totalActivities, firstName) {
  const ratio = totalActivities > 0 ? (completedCount / totalActivities) * 100 : 0;
  
  if (ratio >= 70) {
    return {
      emoji: '🔥',
      title: 'EN FEU !',
      subtitle: `${completedCount} réalisées sur ${totalActivities}`,
      quote: 'Collectionner des moments,\npas des choses'
    };
  } else if (ratio >= 30) {
    return {
      emoji: '🚀',
      title: 'EN PLEINE ACTION !',
      subtitle: `${completedCount} cochées ✅ | ${totalActivities - completedCount} à vivre`,
      quote: 'Chaque aventure commence\npar un premier pas'
    };
  } else {
    return {
      emoji: '🎯',
      title: 'L\'AVENTURE COMMENCE !',
      subtitle: `${completedCount}/${totalActivities} expériences`,
      quote: 'Et vous, qu\'attendez-vous\npour vivre vos rêves ?'
    };
  }
}

/**
 * Calcule les positions du grid selon le nombre d'images
 */
function calculateGridPositions(count, format) {
  const { width, height } = FORMATS[format];
  const positions = [];
  
  // Marges et espacement
  const margin = 40;
  const spacing = 20;
  
  let cols, rows, imgSize;
  
  if (count === 1) {
    // 1 image : plein écran avec marges
    return [{
      x: margin,
      y: margin,
      width: width - (margin * 2),
      height: height - 400 // Laisser place pour le texte
    }];
  } else if (count <= 4) {
    // 2-4 images : grid 2×2
    cols = 2;
    rows = Math.ceil(count / 2);
    imgSize = (width - (margin * 2) - spacing) / 2;
  } else if (count <= 6) {
    // 5-6 images : grid 3×2
    cols = 3;
    rows = 2;
    imgSize = (width - (margin * 2) - (spacing * 2)) / 3;
  } else {
    // 7-9 images : grid 3×3
    cols = 3;
    rows = 3;
    imgSize = (width - (margin * 2) - (spacing * 2)) / 3;
  }
  
  // Calculer les positions
  for (let i = 0; i < Math.min(count, 9); i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    positions.push({
      x: margin + (col * (imgSize + spacing)),
      y: margin + (row * (imgSize + spacing)),
      width: Math.floor(imgSize),
      height: Math.floor(imgSize)
    });
  }
  
  return positions;
}

/**
 * Encode le texte pour URL Cloudinary
 */
function encodeCloudinaryText(text) {
  return encodeURIComponent(text)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\*/g, '%2A');
}

/**
 * Génère l'URL Cloudinary complète avec toutes les transformations
 */
function generateCloudinaryShareImage(options) {
  const {
    activities = [],
    userFirstName = 'Voyageur',
    totalActivities = 0,
    completedCount = 0,
    format = 'instagram'
  } = options;
  
  const formatConfig = FORMATS[format];
  if (!formatConfig) {
    throw new Error(`Format invalide: ${format}`);
  }
  
  const { width, height } = formatConfig;
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  
  // Trier : réalisées en premier
  const sortedActivities = activities.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return -1;
    if (a.status !== 'completed' && b.status === 'completed') return 1;
    return 0;
  });
  
  // Limiter à 9 max
  const displayActivities = sortedActivities.slice(0, 9);
  const remainingCount = Math.max(0, totalActivities - 9);
  
  // Calculer les positions du grid
  const positions = calculateGridPositions(displayActivities.length, format);
  
  // Obtenir le texte engageant
  const engagingText = getEngagingText(completedCount, totalActivities, userFirstName);
  
  // Construire les transformations
  let transformations = [];
  
  // 1. Créer le canvas de base avec fond dégradé
  transformations.push(`w_${width},h_${height},c_fill,b_rgb:1a1a2e`);
  
  // 2. Ajouter un dégradé subtil (overlay)
  transformations.push(`l_gradient:45:from_rgb:16213e_to_rgb:0f3460,w_${width},h_${height},o_30`);
  
  // 3. Ajouter les images d'activités
  displayActivities.forEach((activity, index) => {
    const pos = positions[index];
    const imagePath = `${CLOUDINARY_CONFIG.activitiesPath}:${activity.slug}-hero`;
    
    // Image de l'activité
    transformations.push(
      `l_${imagePath},c_fill,w_${pos.width},h_${pos.height},g_north_west,x_${pos.x},y_${pos.y},r_10`
    );
    
    // Badge ✅ si activité réalisée
    if (activity.status === 'completed') {
      const badgeSize = Math.floor(pos.width * 0.25);
      const badgeX = pos.x + pos.width - badgeSize - 10;
      const badgeY = pos.y + 10;
      
      // Fond vert pour le badge
      transformations.push(
        `l_text:Arial_${Math.floor(badgeSize * 0.6)}_bold:✅,co_rgb:ffffff,b_rgb:00D66B,r_max,g_north_west,x_${badgeX},y_${badgeY}`
      );
    }
    
    // Badge "+X" sur la dernière image si plus de 9 activités
    if (index === 8 && remainingCount > 0) {
      // Overlay sombre sur toute l'image
      transformations.push(
        `l_text:Arial_1: ,w_${pos.width},h_${pos.height},b_rgb:000000,o_80,g_north_west,x_${pos.x},y_${pos.y},r_10`
      );
      
      // Texte "+X"
      const plusText = encodeCloudinaryText(`+${remainingCount}`);
      transformations.push(
        `l_text:Arial_${Math.floor(pos.width * 0.3)}_bold:${plusText},co_rgb:ffffff,g_north_west,x_${pos.x + pos.width / 2},y_${pos.y + pos.height / 2},fl_text_align_center`
      );
    }
  });
  
  // 4. Zone de texte en bas avec fond semi-transparent
  const textBoxHeight = 300;
  const textBoxY = height - textBoxHeight;
  
  transformations.push(
    `l_text:Arial_1: ,w_${width},h_${textBoxHeight},b_rgb:000000,o_85,g_south_west,x_0,y_0`
  );
  
  // 5. Texte principal - Emoji + Titre
  const titleText = encodeCloudinaryText(`${engagingText.emoji} ${engagingText.title}`);
  transformations.push(
    `l_text:Arial_52_bold:${titleText},co_rgb:ffffff,g_south,x_0,y_${textBoxHeight - 60}`
  );
  
  // 6. Sous-titre (nombre d'activités)
  const subtitleText = encodeCloudinaryText(engagingText.subtitle);
  transformations.push(
    `l_text:Arial_32:${subtitleText},co_rgb:ffffff,g_south,x_0,y_${textBoxHeight - 110}`
  );
  
  // 7. Citation motivante (2 lignes)
  const quoteLines = engagingText.quote.split('\n');
  quoteLines.forEach((line, index) => {
    const quoteLine = encodeCloudinaryText(`"${line}"`);
    transformations.push(
      `l_text:Arial_28_italic:${quoteLine},co_rgb:e0e0e0,g_south,x_0,y_${textBoxHeight - 160 - (index * 35)}`
    );
  });
  
  // 8. Logo + Nom en bas à gauche
  transformations.push(
    `l_${CLOUDINARY_CONFIG.logoPath},w_120,g_south_west,x_40,y_40`
  );
  
  const nameText = encodeCloudinaryText(userFirstName);
  transformations.push(
    `l_text:Arial_24_bold:${nameText},co_rgb:ffffff,g_south_west,x_170,y_52`
  );
  
  // 9. URL du site en bas à droite
  transformations.push(
    `l_text:Arial_20:mabucketliste.fr,co_rgb:e0e0e0,g_south_east,x_40,y_52`
  );
  
  // Construire l'URL finale
  const finalUrl = `${baseUrl}/${transformations.join('/')}/placeholder.jpg`;
  
  return {
    imageUrl: finalUrl,
    width: width,
    height: height,
    format: formatConfig.name
  };
}

/**
 * Génère les liens de partage pour tous les réseaux sociaux
 */
function generateAllSocialImages(activities, userFirstName, totalActivities, completedCount) {
  return {
    instagram: generateCloudinaryShareImage({
      activities,
      userFirstName,
      totalActivities,
      completedCount,
      format: 'instagram'
    }),
    facebook: generateCloudinaryShareImage({
      activities,
      userFirstName,
      totalActivities,
      completedCount,
      format: 'facebook'
    }),
    twitter: generateCloudinaryShareImage({
      activities,
      userFirstName,
      totalActivities,
      completedCount,
      format: 'twitter'
    }),
    stories: generateCloudinaryShareImage({
      activities,
      userFirstName,
      totalActivities,
      completedCount,
      format: 'stories'
    })
  };
}

// Exports
module.exports = {
  generateCloudinaryShareImage,
  generateAllSocialImages,
  CLOUDINARY_CONFIG,
  FORMATS
};