// routes/auth-bucket.js
// Endpoints pour auth, bucket list et partage social avec Cloudinary

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateShareLinkData } = require('../utils/shareTokenGenerator');

// ✨ NOUVEAU : Import du helper Cloudinary
const { 
  generateCloudinaryShareImage, 
  generateAllSocialImages 
} = require('../utils/cloudinary-share-helper');

const router = express.Router();

// Configuration Supabase avec clé de service pour bypass RLS
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { supabaseService: supabase } = require('../config/supabase-service');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// ==========================================
// MIDDLEWARE D'AUTHENTIFICATION
// ==========================================

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    // Utiliser Supabase pour vérifier le token
    const { data: user, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ error: 'Token invalide' });
    }

    req.user = user.user;
    req.userId = user.user.id;
    next();
  } catch (error) {
    console.error('Erreur authentification:', error);
    res.status(403).json({ error: 'Token invalide' });
  }
};

// ==========================================
// ENDPOINTS AUTHENTIFICATION
// ==========================================

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, pseudo } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Email, mot de passe, prénom et nom sont requis' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }

    // Créer l'utilisateur avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          pseudo: pseudo || `${firstName}${Math.floor(Math.random() * 1000)}`
        }
      }
    });

    if (authError) {
      return res.status(400).json({ 
        error: 'Erreur lors de l\'inscription', 
        details: authError.message 
      });
    }

    // Créer le profil utilisateur étendu
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert([
        {
          user_id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          pseudo: pseudo || `${firstName}${Math.floor(Math.random() * 1000)}`,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    res.status(201).json({
      message: 'Inscription réussie',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        firstName,
        lastName,
        pseudo: pseudo || `${firstName}${Math.floor(Math.random() * 1000)}`
      },
      session: authData.session
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'inscription' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email et mot de passe requis' 
      });
    }

    // Connexion avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect',
        details: authError.message 
      });
    }

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    res.json({
      message: 'Connexion réussie',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile: profile || null
      },
      session: authData.session,
      access_token: authData.session.access_token
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

// GET /api/auth/me
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    res.json({
      user: req.user,
      profile: profile || null
    });

  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

// ==========================================
// ENDPOINTS BUCKET LIST
// ==========================================

// GET /api/user/bucket-list - SANS slug
router.get('/user/bucket-list', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;

    // 1️⃣ Récupérer la bucket list (SANS les images d'abord)
    let query = supabase
      .from('user_bucket_lists')
      .select(`
        *,
        activity:activities (
          id,
          title,
          subtitle,
          description,
          location,
          image_path,
          image_alt,
          url,
          rating,
          rating_count,
          popularity_score,
          estimated_budget_min,
          estimated_budget_max,
          duration_days,
          difficulty_level,
          best_season,
          is_active,
          is_featured,
          category:categories (
            id,
            name,
            slug,
            icon,
            color
          )
        )
      `)
      .eq('user_id', req.userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: bucketListRaw, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur récupération bucket list:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la récupération de la bucket list',
        details: error.message
      });
    }

    // 2️⃣ ✅ CORRECTION : Récupérer les images Cloudinary en une seule requête
    let imagesMap = {};
    
    if (bucketListRaw && bucketListRaw.length > 0) {
      const activityIds = bucketListRaw.map(item => item.activity.id);
      
      const { data: images, error: imagesError } = await supabase
        .from('activity_images')
        .select('activity_id, cloudinary_public_id, image_type')
        .in('activity_id', activityIds)
        .eq('image_type', 'hero');

      if (imagesError) {
        console.warn('⚠️ Erreur récupération images:', imagesError);
      } else if (images && images.length > 0) {

        // Créer un map pour un accès rapide
        imagesMap = images.reduce((acc, img) => {
          acc[img.activity_id] = img.cloudinary_public_id;
          return acc;
        }, {});
        
        console.log(`✅ ${images.length} images Cloudinary récupérées`);
      }
    }

    // 3️⃣ Formater les données avec cloudinary_public_id
    const bucketList = bucketListRaw?.map(item => {
      let estimatedBudget = 'Prix sur demande';
      if (item.activity.estimated_budget_min && item.activity.estimated_budget_max) {
        estimatedBudget = `${item.activity.estimated_budget_min}-${item.activity.estimated_budget_max}€`;
      } else if (item.activity.estimated_budget_min) {
        estimatedBudget = `À partir de ${item.activity.estimated_budget_min}€`;
      } else if (item.activity.estimated_budget_max) {
        estimatedBudget = `Jusqu'à ${item.activity.estimated_budget_max}€`;
      }

      return {
        id: item.id,
        user_id: item.user_id,
        activity_id: item.activity_id,
        status: item.status,
        date_added: item.date_added,
        planned_date: item.planned_date,
        completed_date: item.completed_date,
        personal_notes: item.personal_notes,
        user_rating: item.rating,
        review: item.review,
        is_shared: item.is_shared,
        share_token: item.share_token,
        personal_budget: item.personal_budget,
        actual_cost: item.actual_cost,
        created_at: item.created_at,
        updated_at: item.updated_at,
        notes: item.notes,
        target_date: item.target_date,
        priority: item.priority,
        activity: {
          id: item.activity.id,
          title: item.activity.title,
          subtitle: item.activity.subtitle,
          description: item.activity.description,
          location: item.activity.location,
          image_path: item.activity.image_path,
          image_alt: item.activity.image_alt,
          url: item.activity.url,
          rating: item.activity.rating,
          rating_count: item.activity.rating_count,
          popularity_score: item.activity.popularity_score,
          estimated_budget: estimatedBudget,
          estimated_budget_min: item.activity.estimated_budget_min,
          estimated_budget_max: item.activity.estimated_budget_max,
          duration_days: item.activity.duration_days,
          difficulty_level: item.activity.difficulty_level,
          best_season: item.activity.best_season,
          is_active: item.activity.is_active,
          is_featured: item.activity.is_featured,
          // ✅ AJOUT CRUCIAL : cloudinary_public_id depuis le map
          cloudinary_public_id: imagesMap[item.activity.id] || null,
          category: {
            id: item.activity.category?.id,
            name: item.activity.category?.name,
            slug: item.activity.category?.slug,
            icon: item.activity.category?.icon,
            color: item.activity.category?.color
          }
        }
      };
    }) || [];

    // 4️⃣ Log de debug
    const withImages = bucketList.filter(i => i.activity.cloudinary_public_id);
    console.log(`📊 Bucket list: ${bucketList.length} activités, ${withImages.length} avec images`);

    res.json({ 
      success: true,
      bucketList: bucketList,
      total: bucketList.length
    });

  } catch (error) {
    console.error('Erreur serveur bucket list:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la récupération de la bucket list' 
    });
  }
});

// POST /api/user/bucket-list/add - SANS slug
router.post('/user/bucket-list/add', authenticateToken, async (req, res) => {
  try {
    const { activityId, notes, priority, target_date } = req.body;

    if (!activityId) {
      return res.status(400).json({ error: 'ID de l\'activité requis' });
    }

    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('id, title')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return res.status(404).json({ error: 'Activité non trouvée' });
    }

    const { data: existing } = await supabase
      .from('user_bucket_lists')
      .select('id')
      .eq('user_id', req.userId)
      .eq('activity_id', activityId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Cette activité est déjà dans votre bucket list' });
    }

    const { data: bucketItem, error } = await supabase
      .from('user_bucket_lists')
      .insert([
        {
          user_id: req.userId,
          activity_id: activityId,
          status: 'planned',
          notes: notes || null,
          priority: priority || 'medium',
          target_date: target_date || null,
          created_at: new Date().toISOString()
        }
      ])
      .select(`
        *,
        activity:activities (
          id,
          title,
          description,
          location,
          image_path,
          difficulty_level,
          rating,
          category:categories(name)
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Activité ajoutée à votre bucket list',
      bucketItem
    });

  } catch (error) {
    console.error('Erreur ajout bucket list:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout à la bucket list' });
  }
});

// PUT /api/user/bucket-list/:id/status - SANS slug
router.put('/user/bucket-list/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, completion_date, rating } = req.body;

    const validStatuses = ['planned', 'in_progress', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Statut invalide. Statuts acceptés: planned, in_progress, completed' 
      });
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (notes) updateData.notes = notes;
    if (status === 'completed') {
      updateData.completion_date = completion_date || new Date().toISOString();
      if (rating && rating >= 1 && rating <= 5) {
        updateData.rating = rating;
      }
    }

    const { data: bucketItem, error } = await supabase
      .from('user_bucket_lists')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select(`
        *,
        activity:activities (
          id,
          title,
          description,
          location,
          image_path,
          difficulty_level,
          rating,
          category:categories(name)
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Item de bucket list non trouvé' });
      }
      throw error;
    }

    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      bucketItem
    });

  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

// DELETE /api/user/bucket-list/:id
router.delete('/user/bucket-list/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID de l\'item bucket list requis' });
    }

    const { data: deletedItem, error } = await supabase
      .from('user_bucket_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
      .select(`
        *,
        activity:activities (
          id,
          title,
          location
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Item de bucket liste non trouvé' });
      }
      throw error;
    }

    res.json({
      success: true,
      message: 'Activité supprimée de votre bucket liste',
      deletedItem
    });

  } catch (error) {
    console.error('Erreur suppression bucket liste:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la bucket liste' });
  }
});

// GET /api/user/stats
router.get('/user/stats', authenticateToken, async (req, res) => {
  try {
    const { data: bucketListStats } = await supabase
      .from('user_bucket_lists')
      .select('status')
      .eq('user_id', req.userId);

    const stats = {
      totalActivities: bucketListStats?.length || 0,
      plannedActivities: bucketListStats?.filter(item => item.status === 'planned').length || 0,
      completedActivities: bucketListStats?.filter(item => item.status === 'completed').length || 0,
      inProgressActivities: bucketListStats?.filter(item => item.status === 'in_progress').length || 0
    };

    stats.completionRate = stats.totalActivities > 0 
      ? Math.round((stats.completedActivities / stats.totalActivities) * 100) 
      : 0;

    res.json({ 
      success: true,
      stats 
    });

  } catch (error) {
    console.error('Erreur statistiques:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// ==========================================
// ✨ NOUVEAUX ENDPOINTS PARTAGE SOCIAL CLOUDINARY
// ==========================================

/**
 * GET /api/user/bucket-list/share/preview
 * Prévisualisation sans authentification (pour tests)
 */
router.get('/user/bucket-list/share/preview', async (req, res) => {
  try {
    console.log('[SHARE PREVIEW] Génération de prévisualisation de test');
    
    // Données de test
    const testActivities = [
      { slug: 'alhambra', title: 'Visiter l\'Alhambra', status: 'completed' },
      { slug: 'surf', title: 'Apprendre le surf', status: 'completed' },
      { slug: 'montgolfiere', title: 'Vol en montgolfière', status: 'completed' },
      { slug: 'parachute', title: 'Saut en parachute', status: 'planned' },
      { slug: 'plongee', title: 'Plongée sous-marine', status: 'planned' }
    ];
    
    const imageData = generateCloudinaryShareImage({
      activities: testActivities,
      userFirstName: 'Redouane',
      totalActivities: 14,
      completedCount: 3,
      format: 'instagram'
    });
    
    return res.json({
      success: true,
      message: 'Prévisualisation de test générée avec succès',
      image: imageData,
      stats: {
        totalActivities: 14,
        completedCount: 3,
        completionRate: 21
      },
      note: 'Ceci est une image de test avec des données fictives pour démonstration'
    });
    
  } catch (error) {
    console.error('[SHARE PREVIEW] Erreur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la prévisualisation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/user/bucket-list/share/:type
 * Génère une image de partage social dynamique avec Cloudinary
 * ✅ AVEC slug (nécessaire pour Cloudinary)
 */
router.get('/user/bucket-list/share/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.userId;
    
    // Validation du type
    const validTypes = ['instagram', 'facebook', 'twitter', 'stories', 'all'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type de partage invalide. Utilisez: instagram, facebook, twitter, stories, ou all'
      });
    }
    
    console.log(`[SHARE] Génération d'image ${type} pour user ${userId}`);
 
    
    // 1. Récupérer la bucket list complète - AVEC slug pour Cloudinary
    let { data: bucketList, error: bucketError } = await supabase
      .from('user_bucket_lists')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        activity:activities (
          id,
          slug,
          title,
          location
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

  // ✅ CORRECTION : Récupérer les cloudinary_public_id comme dans /bucket-list
    let imagesMap = {};
    
    if (bucketList && bucketList.length > 0) {
      const activityIds = bucketList.map(item => item.activity.id);
      
      const { data: images, error: imagesError } = await supabase
        .from('activity_images')
        .select('activity_id, cloudinary_public_id, image_type')
        .in('activity_id', activityIds)
        .eq('image_type', 'hero');

      if (imagesError) {
        console.warn('⚠️ Erreur récupération images pour partage:', imagesError);
      } else if (images && images.length > 0) {
        // Créer un map pour un accès rapide
        imagesMap = images.reduce((acc, img) => {
          acc[img.activity_id] = img.cloudinary_public_id;
          return acc;
        }, {});
        
        console.log(`✅ ${images.length} images Cloudinary récupérées pour partage`);
      }
    }

    // Enrichir bucketList avec cloudinary_public_id
    bucketList = bucketList.map(item => ({
      ...item,
      activity: {
        ...item.activity,
        cloudinary_public_id: imagesMap[item.activity.id] || null
      }
    }));
    
    console.log('🔍 Bucket list pour partage:', bucketList.map(item => ({
      title: item.activity.title,
      cloudinary_public_id: item.activity.cloudinary_public_id
    })));
    
    if (bucketError) {
      console.error('[SHARE] Erreur Supabase bucket list:', bucketError);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la bucket list'
      });
    }
    
    // Vérifier qu'il y a au moins une activité
    if (!bucketList || bucketList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Votre bucket list est vide. Ajoutez des activités avant de partager !',
        helpText: 'Commencez par ajouter des activités à votre liste pour créer votre image de partage.'
      });
    }
    
  // 2. Séparer réalisées et à faire (APRÈS enrichissement avec images)
const completed = bucketList.filter(item => item.status === 'completed');
const pending = bucketList.filter(item => 
  item.status === 'planned' || item.status === 'in_progress'
);

// 3. Prioriser réalisées, puis à faire (max 9)
const selectedActivities = [...completed, ...pending]
  .slice(0, 9)
  .map(item => ({
    cloudinary_public_id: item.activity.cloudinary_public_id, // Maintenant disponible !
    title: item.activity.title,
    status: item.status
  }));

console.log('🎯 Activités sélectionnées avec images:', selectedActivities.map(a => ({
  title: a.title,
  has_image: !!a.cloudinary_public_id
})));
    
    // 4. Récupérer le profil utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .single();
    
    if (profileError) {
      console.error('[SHARE] Erreur récupération profil:', profileError);
    }
    
    const userFirstName = profile?.first_name || profile?.pseudo || 'Voyageur';
    
    // 5. Générer l'image Cloudinary
    let result;
    
   if (type === 'all') {
     console.log('🔥 DEBUT GENERATION IMAGES CLOUDINARY');
  console.log('📊 selectedActivities:', selectedActivities.length);
  

  const { generateShareData } = require('../utils/cloudinary-share-helper');
  
  const stats = {
    total: bucketList.length,
    completed: completed.length,
    pending: pending.length,
    completionRate: Math.round((completed.length / bucketList.length) * 100)
  };
  
  // ⚠️ ATTENTION : La fonction est maintenant asynchrone
  try {
    const shareData = await generateShareData(
      selectedActivities, 
      stats,
      userId // Passer l'ID utilisateur
    );
    result = shareData;
    
 
    
  } catch (error) {
    console.error('❌ Erreur génération images de partage:', error);
    return res.status(500).json({
      success: false,
      error: 'Échec de la génération des images de partage',
      details: error.message
    });
  }
}
    else {
      // Générer une seule image
      const imageData = generateCloudinaryShareImage({
        activities: selectedActivities,
        userFirstName: userFirstName,
        totalActivities: bucketList.length,
        completedCount: completed.length,
        format: type
      });
      
      result = {
        success: true,
        stats: {
          totalActivities: bucketList.length,
          completedCount: completed.length,
          pendingCount: pending.length,
          completionRate: Math.round((completed.length / bucketList.length) * 100)
        },
        image: imageData,
        shareLinks: generateCloudinaryShareLinks(imageData.imageUrl, userFirstName)
      };
    }
    
    console.log('[SHARE] Image(s) générée(s) avec succès');
    return res.json(result);
    
  } catch (error) {
    console.error('[SHARE] Erreur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de l\'image de partage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/user/bucket-list/share/download
 * Logger les téléchargements (analytics)
 */
router.post('/user/bucket-list/share/download', authenticateToken, async (req, res) => {
  try {
    const { imageUrl, format = 'instagram' } = req.body;
    const userId = req.userId;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL de l\'image manquante'
      });
    }
    
    // Logger pour analytics
    console.log(`[DOWNLOAD] User ${userId} télécharge image format ${format}`);
    
    // TODO: Sauvegarder en base pour analytics si besoin
    
    return res.json({
      success: true,
      downloadUrl: imageUrl,
      filename: `ma-bucket-liste-${format}-${Date.now()}.jpg`,
      message: 'Téléchargement enregistré avec succès'
    });
    
  } catch (error) {
    console.error('[DOWNLOAD] Erreur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du téléchargement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

/**
 * Génère les liens de partage Cloudinary pour tous les réseaux
 */
function generateCloudinaryShareLinks(imageUrl, userName) {
  const siteUrl = 'https://mabucketliste.fr';
  const shareText = `Découvrez la bucket list de ${userName} sur Ma Bucket Liste ! 🌍✨`;
  const hashtags = 'bucketlist,voyage,aventure,mabucketliste';
  
  return {
    instagram: {
      note: 'Instagram ne supporte pas le partage direct via URL web',
      instructions: 'Téléchargez l\'image et partagez-la manuellement sur Instagram',
      imageUrl: imageUrl
    },
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}&quote=${encodeURIComponent(shareText)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(siteUrl)}&hashtags=${hashtags}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + siteUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(siteUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent(shareText)}`,
    email: `mailto:?subject=${encodeURIComponent('Ma Bucket Liste - ' + userName)}&body=${encodeURIComponent(shareText + '\n\n' + siteUrl)}`,
    direct: imageUrl
  };
}

/**
 * Génère les liens de partage (version originale pour compatibilité)
 */
function generateSocialLinks(shareContent) {
  const encodedText = encodeURIComponent(shareContent.text);
  const encodedUrl = encodeURIComponent(shareContent.url);
  const encodedTitle = encodeURIComponent(shareContent.title);
  const encodedDescription = encodeURIComponent(shareContent.description);
  const hashtags = shareContent.hashtags.join(',');

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${hashtags}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}&media=${encodeURIComponent(shareContent.image || 'https://mabucketliste.fr/images/default-share.jpg')}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    instagram: {
      type: 'manual',
      instructions: {
        step1: 'Copier le texte ci-dessous',
        step2: 'Ouvrir Instagram et créer une nouvelle publication',
        step3: 'Coller le texte en légende',
        text: shareContent.text,
        hashtags: shareContent.hashtags.map(tag => `#${tag}`).join(' '),
        image_suggestion: shareContent.image || 'https://mabucketliste.fr/images/bucket-list-template.jpg'
      },
      web_url: 'https://www.instagram.com'
    },
    tiktok: {
      type: 'manual',
      instructions: {
        step1: 'Créer une vidéo montrant votre bucket list',
        step2: 'Utiliser le texte ci-dessous comme description',
        step3: 'Ajouter les hashtags suggérés', text: shareContent.text,
        hashtags: shareContent.hashtags.concat(['BucketListChallenge', 'TravelGoals', 'LifeGoals']).map(tag => `#${tag}`).join(' '),
        video_ideas: [
          'Montrer les photos des activités de votre liste',
          'Faire un before/after de vos réalisations',
          'Créer un défi bucket list',
          'Partager vos conseils pour réaliser ses rêves'
        ]
      },
      web_url: 'https://www.tiktok.com'
    },
    snapchat: `https://www.snapchat.com/scan?attachmentUrl=${encodedUrl}`,
    copy: shareContent.url,
    native: {
      title: shareContent.title,
      text: shareContent.text,
      url: shareContent.url
    }
  };
}
/**
 * POST /api/user/bucket-list/share/create
 * Crée un lien de partage avec token unique pour une plateforme sociale
 */
router.post('/user/bucket-list/share/create', authenticateToken, async (req, res) => {
  try {
    const { platform, imageUrl, stats } = req.body;
    const userId = req.user.Id;
    
    console.log('📝 Création d\'un lien de partage:', { userId, platform });
    
    // 1. Validation des inputs
    const validPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin'];
    
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Platform invalide. Doit être: facebook, twitter, instagram ou linkedin'
      });
    }
    
    if (!imageUrl || !imageUrl.startsWith('https://res.cloudinary.com/')) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl invalide. Doit être une URL Cloudinary valide'
      });
    }
    
    if (!stats || typeof stats !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'stats invalide. Doit être un objet avec totalActivities, completedCount, pendingCount, completionRate'
      });
    }
    
    const requiredStatsFields = ['totalActivities', 'completedCount', 'pendingCount', 'completionRate'];
    const missingFields = requiredStatsFields.filter(field => !(field in stats));
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Champs manquants dans stats: ${missingFields.join(', ')}`
      });
    }
    
    // 2. Générer les données du lien de partage avec token unique
    const shareLinkData = await generateShareLinkData(
      supabase,
      userId,
      platform,
      imageUrl,
      stats
    );
    
    console.log(`✅ Token unique généré: ${shareLinkData.share_token}`);
    
    // 3. Insérer en base de données
    const { data: insertedLink, error: insertError } = await supabase
      .from('share_links')
      .insert([shareLinkData])
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Erreur insertion lien de partage:', insertError);
      throw insertError;
    }
    
    console.log(`✅ Lien de partage créé avec succès (ID: ${insertedLink.id})`);
    
    // 4. Construire la réponse
    const shareUrl = `${process.env.API_BASE_URL}/share/${insertedLink.share_token}`;
    
    res.json({
      success: true,
      shareLink: {
        id: insertedLink.id,
        token: insertedLink.share_token,
        url: shareUrl,
        platform: insertedLink.platform,
        imageUrl: insertedLink.image_url,
        stats: insertedLink.stats,
        expiresAt: insertedLink.expires_at,
        createdAt: insertedLink.created_at
      },
      message: 'Lien de partage créé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du lien de partage:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la création du lien de partage',
      details: error.message
    });
  }
});

/**
 * GET /api/user/bucket-list/share/analytics
 * BONUS OPTIONNEL - Récupère les statistiques d'analytics des partages de l'utilisateur
 */
router.get('/user/bucket-list/share/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.Id;
    
    console.log('📊 Récupération analytics pour user:', userId);
    
    // 1. Récupérer tous les liens de partage de l'utilisateur
    const { data: shareLinks, error: fetchError } = await supabase
      .from('share_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Erreur récupération analytics:', fetchError);
      throw fetchError;
    }
    
    // 2. Calculer les statistiques globales
    const totalShares = shareLinks.length;
    const totalViews = shareLinks.reduce((sum, link) => sum + link.views_count, 0);
    const totalClicks = shareLinks.reduce((sum, link) => sum + link.clicks_count, 0);
    
    // 3. Statistiques par plateforme
    const platformStats = shareLinks.reduce((acc, link) => {
      if (!acc[link.platform]) {
        acc[link.platform] = {
          shares: 0,
          views: 0,
          clicks: 0
        };
      }
      
      acc[link.platform].shares += 1;
      acc[link.platform].views += link.views_count;
      acc[link.platform].clicks += link.clicks_count;
      
      return acc;
    }, {});
    
    // 4. Les 10 derniers partages
    const recentShares = shareLinks.slice(0, 10).map(link => ({
      id: link.id,
      token: link.share_token,
      url: `${process.env.API_BASE_URL}/share/${link.share_token}`,
      platform: link.platform,
      views: link.views_count,
      clicks: link.clicks_count,
      lastAccessed: link.last_accessed_at,
      createdAt: link.created_at,
      expiresAt: link.expires_at,
      isActive: link.is_active && new Date() < new Date(link.expires_at)
    }));
    
    // 5. Liens actifs vs expirés
    const now = new Date();
    const activeLinks = shareLinks.filter(link => 
      link.is_active && new Date(link.expires_at) > now
    ).length;
    const expiredLinks = totalShares - activeLinks;
    
    console.log(`✅ Analytics calculées: ${totalShares} partages, ${totalViews} vues, ${totalClicks} clics`);
    
    res.json({
      success: true,
      analytics: {
        global: {
          totalShares,
          totalViews,
          totalClicks,
          activeLinks,
          expiredLinks,
          averageClickRate: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : 0
        },
        byPlatform: platformStats,
        recentShares
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des analytics',
      details: error.message
    });
  }
});

module.exports = router;