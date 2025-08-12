const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middlewares de sécurité
app.use(helmet());
app.use(cors({
  origin: ['https://ma-bucket-liste.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite de 100 requêtes par fenêtre par IP
  message: { error: 'Trop de requêtes, réessayez plus tard.' }
});
app.use('/api/', limiter);

// Parser JSON
app.use(express.json());

// Route de test
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Ma Bucket Liste - Opérationnelle ✅',
    version: '1.0.0',
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

// ROUTES PRINCIPALES

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

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 API Ma Bucket Liste démarrée sur le port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});