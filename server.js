const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// ==========================================
// 1. CONFIGURATION (EN PREMIER)
// ==========================================
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ==========================================
// 2. MIDDLEWARES DE PARSING (AVANT LES ROUTES)
// ==========================================
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ==========================================
// 3. MIDDLEWARES DE SÉCURITÉ
// ==========================================
app.use(helmet());
app.use(cors({
  origin: [
    'https://ma-bucket-liste.vercel.app', 
    'http://localhost:3000',
    'http://127.0.0.1:5500'  // Pour Live Server en développement
  ],
  credentials: true
}));

// ==========================================
// 4. RATE LIMITING
// ==========================================
// Rate limiting général
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite de 100 requêtes par fenêtre par IP
  message: { error: 'Trop de requêtes, réessayez plus tard.' }
});
app.use('/api/', limiter);

// Rate limiting spécial pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 tentatives de connexion par IP
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' }
});

// ==========================================
// 5. IMPORTER LES ROUTES
// ==========================================
const authBucketRoutes = require('./routes/auth-bucket');
const userProfileRoutes = require('./routes/user-profile');

// ==========================================
// 6. ROUTES PRINCIPALES (existantes)
// ==========================================

// Route de test
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Ma Bucket Liste - Opérationnelle ✅',
    version: '2.0.0', // Mise à jour de version
    features: [
      'Activités et recherche',
      'Authentification utilisateurs',
      'Bucket lists personnelles',
      'Partage sur réseaux sociaux'
    ],
    timestamp: new Date().toISOString()
  });
});

// Route de test Supabase
app.get('/api/test', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    res.json({ 
      message: 'Connexion Supabase OK ✅',
      supabase_connected: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Erreur connexion Supabase ❌',
      details: error.message 
    });
  }
});

// 🌍 Récupérer toutes les activités avec filtres optionnels
app.get('/api/activities', async (req, res) => {
  try {
    const { continent, category, difficulty, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('activities')
      .select(`
        *,
        categories(name, icon),
        continents(name)
      `)
      .order('created_at', { ascending: false });

    // Filtres
    if (continent) query = query.eq('continent_id', continent);
    if (category) query = query.eq('category_id', category);
    if (difficulty) query = query.eq('difficulty', difficulty);
    
    // Pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      meta: {
        count: data.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🎯 Récupérer une activité par ID
app.get('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        categories(name, icon),
        continents(name)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Activité non trouvée' });
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📂 Récupérer toutes les catégories
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🌍 Récupérer tous les continents
app.get('/api/continents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('continents')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔍 Recherche d'activités
app.get('/api/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q) return res.status(400).json({ error: 'Paramètre de recherche manquant' });
    
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        categories(name, icon),
        continents(name)
      `)
      .or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`)
      .limit(parseInt(limit));
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      meta: {
        query: q,
        count: data.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 Statistiques globales
app.get('/api/stats', async (req, res) => {
  try {
    // Compter les activités par catégorie
    const { data: categoriesStats, error: catError } = await supabase
      .from('activities')
      .select('category_id, categories(name)')
      .not('category_id', 'is', null);
    
    if (catError) throw catError;
    
    // Compter les activités par continent
    const { data: continentsStats, error: contError } = await supabase
      .from('activities')
      .select('continent_id, continents(name)')
      .not('continent_id', 'is', null);
    
    if (contError) throw contError;
    
    // Compter total d'activités
    const { count: totalActivities, error: countError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    res.json({
      success: true,
      data: {
        total_activities: totalActivities,
        by_category: categoriesStats,
        by_continent: continentsStats
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. ROUTES AVEC AUTHENTIFICATION (EN DERNIER)
// ==========================================

// Appliquer le rate limiting spécial aux endpoints d'auth
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Utiliser les nouvelles routes d'authentification et bucket list
app.use('/api', authBucketRoutes);
app.use('/api/user', userProfileRoutes);

// ==========================================
// 8. GESTION DES ERREURS
// ==========================================

// Middleware de gestion d'erreurs Multer (upload fichiers)
app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Fichier trop volumineux (max 2MB)'
    });
  }
  
  if (error.message === 'Seuls les fichiers image sont autorisés') {
    return res.status(400).json({
      success: false,
      message: 'Format de fichier non supporté. Utilisez JPG, PNG ou GIF.'
    });
  }

  console.error('Erreur serveur:', error);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur interne'
  });
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    available_endpoints: [
      'GET /',
      'GET /api/test',
      'GET /api/activities',
      'GET /api/activities/:id',
      'GET /api/categories',
      'GET /api/continents', 
      'GET /api/search',
      'GET /api/stats',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/user/bucket-list',
      'POST /api/user/bucket-list/add',
      'PUT /api/user/bucket-list/:id/status',
      'GET /api/user/stats',
      'GET /api/user/profile',
      'PUT /api/user/profile',
      'POST /api/user/avatar',
      'DELETE /api/user/avatar',
      'GET /api/user/bucket-list/share/:type (summary|stats|instagram|tiktok)'
    ]
  });
});

// Middleware de gestion d'erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Format JSON invalide' });
  }

  res.status(500).json({
    error: 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// ==========================================
// 9. DÉMARRAGE DU SERVEUR
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 API Ma Bucket Liste démarrée sur le port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📋 Nouveaux endpoints disponibles :`);
  console.log(`   • POST /api/auth/register - Inscription`);
  console.log(`   • POST /api/auth/login - Connexion`);
  console.log(`   • GET  /api/user/bucket-list - Ma bucket list`);
  console.log(`   • POST /api/user/bucket-list/add - Ajouter activité`);
  console.log(`   • GET  /api/user/profile - Mon profil`);
  console.log(`   • PUT  /api/user/profile - Modifier profil`);
  console.log(`   • POST /api/user/avatar - Upload avatar`);
  console.log(`   • DELETE /api/user/avatar - Supprimer avatar`);
  console.log(`   • GET  /api/user/bucket-list/share/summary - Partage résumé`);
  console.log(`   • GET  /api/user/bucket-list/share/stats - Partage statistiques`);
  console.log(`   • GET  /api/user/bucket-list/share/instagram - Partage Instagram`);
  console.log(`   • GET  /api/user/bucket-list/share/tiktok - Partage TikTok`);
  console.log(`   • PUT  /api/user/bucket-list/:id/status - Changer statut`);
  console.log(`   • GET  /api/user/stats - Statistiques utilisateur`);
});