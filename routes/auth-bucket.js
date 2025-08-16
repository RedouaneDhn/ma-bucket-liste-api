// routes/auth-bucket.js
// Nouveaux endpoints pour auth et partage social

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Configuration Supabase avec clé de service pour bypass RLS
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// GET /api/user/bucket-list
router.get('/user/bucket-list', authenticateToken, async (req, res) => {
  try {
    const { status, category, continent } = req.query;

    let query = supabase
      .from('user_bucket_lists')
      .select(`
        *,
        activity:activities (
          id,
          title,
          description,
          location,
          difficulty,
          estimated_cost,
          estimated_duration,
          category:categories(name, color),
          continent:continents(name)
        )
      `)
      .eq('user_id', req.userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: bucketList, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ 
      success: true,
      bucketList: bucketList || [],
      total: bucketList?.length || 0
    });

  } catch (error) {
    console.error('Erreur récupération bucket list:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la bucket list' });
  }
});

// POST /api/user/bucket-list/add
router.post('/user/bucket-list/add', authenticateToken, async (req, res) => {
  try {
    const { activityId, notes, priority, target_date } = req.body;

    if (!activityId) {
      return res.status(400).json({ error: 'ID de l\'activité requis' });
    }

    // Vérifier si l'activité existe
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('id, title')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return res.status(404).json({ error: 'Activité non trouvée' });
    }

    // Vérifier si l'activité n'est pas déjà dans la bucket list
    const { data: existing } = await supabase
      .from('user_bucket_lists')
      .select('id')
      .eq('user_id', req.userId)
      .eq('activity_id', activityId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Cette activité est déjà dans votre bucket list' });
    }

    // Ajouter à la bucket list
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
          difficulty,
          category:categories(name),
          continent:continents(name)
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

// PUT /api/user/bucket-list/:id/status
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
          difficulty,
          category:categories(name),
          continent:continents(name)
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
// ENDPOINTS PARTAGE SOCIAL
// ==========================================

// GET /api/user/bucket-list/share/:type
router.get('/user/bucket-list/share/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const { activityIds, message } = req.query;

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, pseudo')
      .eq('user_id', req.userId)
      .single();

    const userName = profile ? 
      `${profile.first_name} ${profile.last_name}` : 
      profile?.pseudo || 'Un utilisateur';

    let shareContent = {};

    switch (type) {
      case 'summary':
        const { data: bucketList } = await supabase
          .from('user_bucket_lists')
          .select(`
            *,
            activity:activities (
              title, 
              category:categories(name),
              continent:continents(name)
            )
          `)
          .eq('user_id', req.userId)
          .order('created_at', { ascending: false })
          .limit(5);

        const totalActivities = bucketList?.length || 0;
        const completedCount = bucketList?.filter(item => item.status === 'completed').length || 0;
        const completionRate = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

        shareContent = {
          title: `🎯 Ma Bucket Liste`,
          description: `${userName} a ${totalActivities} activités dans sa bucket list avec ${completionRate}% de réalisation !`,
          text: `🌟 Ma bucket list compte ${totalActivities} expériences incroyables !\n✅ ${completedCount} déjà réalisées (${completionRate}%)\n\n#BucketList #Expériences #Aventure`,
          url: `https://ma-bucket-liste.vercel.app`,
          hashtags: ['BucketList', 'Expériences', 'Aventure', 'Voyage']
        };
        break;

      case 'stats':
        const { data: allBucketItems } = await supabase
          .from('user_bucket_lists')
          .select('status')
          .eq('user_id', req.userId);

        const statsData = {
          total: allBucketItems?.length || 0,
          completed: allBucketItems?.filter(item => item.status === 'completed').length || 0,
          planned: allBucketItems?.filter(item => item.status === 'planned').length || 0
        };

        shareContent = {
          title: `📊 Mes statistiques Bucket Liste`,
          description: `${userName} : ${statsData.completed}/${statsData.total} activités réalisées`,
          text: `📊 Mes stats de bucket list :\n\n🎯 ${statsData.total} activités au total\n✅ ${statsData.completed} réalisées\n📝 ${statsData.planned} planifiées\n📈 ${Math.round((statsData.completed / statsData.total) * 100) || 0}% de réalisation\n\n#BucketListStats #Objectifs2025`,
          url: `https://ma-bucket-liste.vercel.app`,
          hashtags: ['BucketListStats', 'Objectifs2025', 'Motivation'],
          image: 'https://ma-bucket-liste.vercel.app/images/stats-share.jpg'
        };
        break;

      case 'instagram':
        // Contenu optimisé spécifiquement pour Instagram
        const { data: instagramBucketList } = await supabase
          .from('user_bucket_lists')
          .select(`
            *,
            activity:activities (
              title,
              category:categories(name),
              continent:continents(name)
            )
          `)
          .eq('user_id', req.userId)
          .order('created_at', { ascending: false })
          .limit(6); // Grille de 6 pour Instagram

        const instagramStats = {
          total: instagramBucketList?.length || 0,
          completed: instagramBucketList?.filter(item => item.status === 'completed').length || 0
        };

        shareContent = {
          title: `✨ Ma Bucket List d'expériences de rêve`,
          description: `Suivez mes aventures ! ${instagramStats.completed}/${instagramStats.total} déjà réalisées 🌟`,
          text: `✨ Ma bucket list d'expériences de rêve !\n\n🌟 ${instagramStats.total} aventures à vivre\n✅ ${instagramStats.completed} déjà cochées\n\n${instagramBucketList?.slice(0, 3).map((item, index) => `${index + 1}. ${item.activity.title} ${item.status === 'completed' ? '✅' : '📍'}`).join('\n') || ''}\n\nEt vous, quelle est votre prochaine aventure ?`,
          url: `https://ma-bucket-liste.vercel.app`,
          hashtags: ['BucketList', 'TravelGoals', 'LifeGoals', 'Adventure', 'Dreams', 'Wanderlust', 'Experience', 'Goals2025'],
          image: 'https://ma-bucket-liste.vercel.app/images/instagram-template.jpg',
          instagram_specific: {
            story_text: `Ma bucket list 📋\n${instagramStats.completed}/${instagramStats.total} réalisées ✨`,
            grid_layout: instagramBucketList?.slice(0, 6).map(item => ({
              title: item.activity.title,
              status: item.status
            })) || []
          }
        };
        break;

      case 'tiktok':
        // Contenu optimisé pour TikTok avec suggestions de vidéos
        const { data: tiktokBucketList } = await supabase
          .from('user_bucket_lists')
          .select(`
            *,
            activity:activities (
              title,
              category:categories(name),
              continent:continents(name)
            )
          `)
          .eq('user_id', req.userId)
          .order('created_at', { ascending: false })
          .limit(10);

        const completedActivities = tiktokBucketList?.filter(item => item.status === 'completed') || [];
        const plannedActivities = tiktokBucketList?.filter(item => item.status === 'planned') || [];

        shareContent = {
          title: `🎬 Ma Bucket List TikTok`,
          description: `Mes aventures en vidéo ! ${completedActivities.length} expériences réalisées`,
          text: `🎬 Ma bucket list en mode TikTok !\n\n✅ ${completedActivities.length} expériences déjà vécues\n📍 ${plannedActivities.length} encore à découvrir\n\n${plannedActivities.slice(0, 3).map((item, index) => `${index + 1}. ${item.activity.title}`).join('\n') || ''}\n\nQui veut faire ça avec moi ? 🤗`,
          url: `https://ma-bucket-liste.vercel.app`,
          hashtags: ['BucketList', 'BucketListChallenge', 'TravelTok', 'LifeGoals', 'Adventure', 'Challenge', 'Goals2025', 'DreamLife'],
          image: 'https://ma-bucket-liste.vercel.app/images/tiktok-template.jpg',
          tiktok_specific: {
            video_ideas: [
              `Montrer ${Math.min(completedActivities.length, 5)} activités réalisées en 30 secondes`,
              'Révéler votre prochaine aventure avec un effet de suspense',
              'Before/After de vos plus belles réalisations',
              'Challenge : "Devine mon prochain objectif"',
              'Top 3 des activités qui ont changé votre vie'
            ],
            trending_sounds: [
              'Adventure time music',
              'Dreams come true audio',
              'Travel vibes sound',
              'Achievement unlocked sound'
            ],
            hooks: [
              'POV: Tu as une bucket list de folie 🤯',
              'Les 3 choses que je DOIS faire avant mes 30 ans',
              'Ma bucket list vs la réalité 😅',
              'Plot twist : j\'ai vraiment fait ça ! ✨'
            ]
          }
        };
        break;

      default:
        return res.status(400).json({ error: 'Type de partage non supporté' });
    }

    // Générer les liens de partage
    const socialLinks = generateSocialLinks(shareContent);

    res.json({
      success: true,
      shareContent,
      socialLinks
    });

  } catch (error) {
    console.error('Erreur génération contenu partage:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du contenu de partage' });
  }
});

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

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
    
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}&media=${encodeURIComponent(shareContent.image || 'https://ma-bucket-liste.vercel.app/images/default-share.jpg')}`,
    
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    
    // Instagram - Instructions pour partage manuel
    instagram: {
      type: 'manual',
      instructions: {
        step1: 'Copier le texte ci-dessous',
        step2: 'Ouvrir Instagram et créer une nouvelle publication',
        step3: 'Coller le texte en légende',
        text: shareContent.text,
        hashtags: shareContent.hashtags.map(tag => `#${tag}`).join(' '),
        image_suggestion: shareContent.image || 'https://ma-bucket-liste.vercel.app/images/bucket-list-template.jpg'
      },
      web_url: 'https://www.instagram.com'
    },
    
    // TikTok - Instructions pour partage manuel avec suggestions
    tiktok: {
      type: 'manual',
      instructions: {
        step1: 'Créer une vidéo montrant votre bucket list',
        step2: 'Utiliser le texte ci-dessous comme description',
        step3: 'Ajouter les hashtags suggérés',
        text: shareContent.text,
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
    
    // Snapchat - Partage via URL scheme
    snapchat: `https://www.snapchat.com/scan?attachmentUrl=${encodedUrl}`,
    
    // Copier le lien
    copy: shareContent.url,
    
    // Partage natif (pour mobile)
    native: {
      title: shareContent.title,
      text: shareContent.text,
      url: shareContent.url
    }
  };
}

module.exports = router;