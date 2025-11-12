/**
 * @fileoverview Routes pour le système de partage social avec Open Graph
 * @module routes/share
 */

const express = require('express');
const router = express.Router();

// Utiliser la configuration Supabase existante de votre projet
const { supabaseService: supabase } = require('../config/supabase-service');


/**
 * Détecte si le User-Agent est un bot (crawler social)
 * 
 * @param {string} userAgent - User-Agent HTTP header
 * @returns {boolean} true si c'est un bot, false sinon
 */
function isBot(userAgent) {
  if (!userAgent) return false;
  
  const botPattern = /bot|crawler|spider|facebook|twitter|linkedin|pinterest|whatsapp|telegram|slack|discordbot|bingpreview|googlebot|yandexbot|baiduspider|twitterbot|facebookexternalhit|linkedinbot|slackbot/i;
  const isDetectedBot = botPattern.test(userAgent);
  
  // ✅ Log pour debug AVANT le return
  if (isDetectedBot) {
    console.log(`🤖 Bot détecté: ${userAgent.substring(0, 50)}...`);
  }
  
  return isDetectedBot;
}

/**
 * Génère le HTML de la page de partage avec métadonnées Open Graph
 * 
 * @param {Object} shareData - Données du lien de partage
 * @param {Object} userProfile - Profil de l'utilisateur
 * @param {string} shareUrl - URL complète du lien de partage
 * @param {boolean} isForBot - true si destiné à un bot (pas de redirect)
 * @returns {string} HTML complet de la page
 */
function generateSharePageHTML(shareData, userProfile, shareUrl, isForBot) {
  const { stats, image_url, platform } = shareData;
  const { first_name, last_name } = userProfile;
  
  const title = `🎯 Ma Bucket List - ${first_name} ${last_name}`;
  const description = `Découvrez la Bucket List de ${first_name} : ${stats.totalActivities} activités, ${stats.completedCount} réalisées. Progression : ${stats.completionRate}% 🚀`;
  
  // Dimensions selon la plateforme
  const imageDimensions = {
    facebook: { width: 1200, height: 630 },
    twitter: { width: 1200, height: 675 },
    instagram: { width: 1080, height: 1080 },
    linkedin: { width: 1200, height: 630 }
  };
  
  const dimensions = imageDimensions[platform] || { width: 1200, height: 630 };
  
  // Meta refresh et JavaScript redirect uniquement pour les vrais utilisateurs
  const redirectCode = !isForBot ? `
    <meta http-equiv="refresh" content="3;url=${process.env.FRONTEND_URL}">
    <script>
      // Fallback JavaScript redirect
      setTimeout(function() {
        window.location.href = '${process.env.FRONTEND_URL}';
      }, 3000);
    </script>
  ` : '';
  
  const bodyContent = !isForBot ? `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
      <div style="text-align: center;">
        <div class="spinner"></div>
        <h1 style="color: #333; margin-top: 20px;">Chargement de votre Bucket Liste...</h1>
        <p style="color: #666;">Redirection dans 3 secondes</p>
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL}" style="color: #007bff; text-decoration: none; font-size: 16px;">
            Cliquez ici pour accéder immédiatement
          </a>
        </p>
      </div>
    </div>
    <style>
      .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  ` : `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="text-align: center; max-width: 600px; padding: 20px;">
        <h1 style="color: #333;">🎯 Ma Bucket List</h1>
        <p style="color: #666; font-size: 18px;">${description}</p>
        <img src="${image_url}" alt="Bucket List de ${first_name}" style="max-width: 100%; margin-top: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      </div>
    </div>
  `;
  
  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${shareUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image_url}">
    <meta property="og:image:width" content="${dimensions.width}">
    <meta property="og:image:height" content="${dimensions.height}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:site_name" content="Ma Bucket Liste">
    <meta property="og:locale" content="fr_FR">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${shareUrl}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image_url}">
    
    <!-- LinkedIn -->
    <meta property="linkedin:owner" content="Ma Bucket Liste">
    
    <!-- Instagram / autres -->
    <meta name="description" content="${description}">
    <meta name="author" content="${first_name} ${last_name}">
    
    ${redirectCode}
</head>
<body>
    ${bodyContent}
</body>
</html>`;
}

/**
 * Génère le HTML de la page 404 (token introuvable)
 */
function generate404Page() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lien introuvable - Ma Bucket Liste</title>
    <meta http-equiv="refresh" content="5;url=${process.env.FRONTEND_URL}">
</head>
<body>
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; text-align: center; padding: 20px;">
      <h1 style="color: #333; font-size: 48px;">🔍</h1>
      <h2 style="color: #666;">Lien de partage introuvable</h2>
      <p style="color: #999; max-width: 500px; margin: 20px 0;">
        Ce lien de partage n'existe pas ou a été supprimé.
      </p>
      <p style="color: #999;">
        Redirection vers la page d'accueil dans 5 secondes...
      </p>
      <a href="${process.env.FRONTEND_URL}" style="margin-top: 20px; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; font-size: 16px;">
        Retourner à l'accueil
      </a>
    </div>
</body>
</html>`;
}

/**
 * Génère le HTML de la page 410 Gone (token expiré)
 */
function generate410Page() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lien expiré - Ma Bucket Liste</title>
    <meta http-equiv="refresh" content="5;url=${process.env.FRONTEND_URL}">
</head>
<body>
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; text-align: center; padding: 20px;">
      <h1 style="color: #333; font-size: 48px;">⏰</h1>
      <h2 style="color: #666;">Lien de partage expiré</h2>
      <p style="color: #999; max-width: 500px; margin: 20px 0;">
        Ce lien de partage a expiré. Les liens de partage sont valables 30 jours.
      </p>
      <p style="color: #999;">
        Redirection vers la page d'accueil dans 5 secondes...
      </p>
      <a href="${process.env.FRONTEND_URL}" style="margin-top: 20px; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; font-size: 16px;">
        Retourner à l'accueil
      </a>
    </div>
</body>
</html>`;
}

/**
 * Route principale : GET /share/:token
 * Gère l'affichage de la page de partage avec Open Graph et la redirection
 */
router.get('/:token', async (req, res) => {
  const { token } = req.params;
  const userAgent = req.headers['user-agent'] || '';
  const isBotRequest = isBot(userAgent);
  
  console.log(`📊 Accès au lien de partage: ${token}`);
  console.log(`👤 User-Agent: ${userAgent}`);
  console.log(`🤖 Est un bot: ${isBotRequest}`);
  
  try {
    // 1. Récupérer le lien de partage
    const { data: shareLink, error: shareLinkError } = await supabase
      .from('share_links')
      .select('*')
      .eq('share_token', token)
      .single();
    
    console.log('🔍 Résultat requête:', { shareLink, error: shareLinkError });
    
    // 2. Vérifier si le lien existe
    if (shareLinkError || !shareLink) {
      console.log(`❌ Token introuvable: ${token}`);
      return res.status(404).send(generate404Page());
    }
    
    // 3. Récupérer le profil utilisateur séparément
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('id', shareLink.user_id)
      .single();
    
    if (profileError || !userProfile) {
      console.error('❌ Erreur récupération profil:', profileError);
      // Utiliser des valeurs par défaut si le profil n'est pas trouvé
      userProfile = {
        first_name: 'Utilisateur',
        last_name: 'Anonyme',
        email: ''
      };
    }
    
    console.log('👤 Profil utilisateur récupéré:', userProfile);
    
    // 4. Vérifier si le lien est expiré
    const now = new Date();
    const expiresAt = new Date(shareLink.expires_at);
    
    if (!shareLink.is_active || now > expiresAt) {
      console.log(`⏰ Token expiré: ${token} (expires_at: ${shareLink.expires_at})`);
      return res.status(410).send(generate410Page());
    }
    
    // 5. Mettre à jour les analytics
    const updateData = {
      views_count: shareLink.views_count + 1,
      last_accessed_at: now.toISOString()
    };
    
    // Incrémenter clicks_count uniquement pour les vrais utilisateurs
    if (!isBotRequest) {
      updateData.clicks_count = shareLink.clicks_count + 1;
      console.log(`👆 Clic utilisateur enregistré (total: ${updateData.clicks_count})`);
    }
    
    const { error: updateError } = await supabase
      .from('share_links')
      .update(updateData)
      .eq('id', shareLink.id);
    
    if (updateError) {
      console.error('❌ Erreur mise à jour analytics:', updateError);
    } else {
      console.log(`✅ Analytics mis à jour - Vues: ${updateData.views_count}, Clics: ${updateData.clicks_count || shareLink.clicks_count}`);
    }
    
    // 6. Construire l'URL complète du partage
    const shareUrl = `${process.env.API_BASE_URL}/share/${token}`;
    
    // 7. Générer et retourner la page HTML
    const html = generateSharePageHTML(
      shareLink,
      userProfile,
      shareUrl,
      isBotRequest
    );
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error) {
    console.error('❌ Erreur serveur lors de la récupération du lien de partage:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erreur - Ma Bucket Liste</title>
          <meta http-equiv="refresh" content="5;url=${process.env.FRONTEND_URL}">
      </head>
      <body>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; text-align: center;">
            <h1 style="color: #dc3545;">Une erreur est survenue</h1>
            <p style="color: #666;">Redirection vers la page d'accueil...</p>
            <a href="${process.env.FRONTEND_URL}" style="margin-top: 20px; color: #007bff; text-decoration: none;">
              Cliquer ici si la redirection ne fonctionne pas
            </a>
          </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;