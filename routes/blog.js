const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// GET /api/blog/list
router.get('/list', async (req, res) => {
  const { categorie, search, limit = 20, offset = 0 } = req.query;

  try {
    let query = supabase
      .from('articles')
      .select('id, slug, titre, introduction, image_url, categorie, tags, created_at')
      .eq('publie', true)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (categorie) query = query.eq('categorie', categorie);
    if (search) {
      query = query.or(`titre.ilike.%${search}%,introduction.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, articles: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/blog/get?slug=mon-article
router.get('/get', async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ success: false, error: 'Slug manquant' });

  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('publie', true)
      .single();

    if (error) throw error;
    res.json({ success: true, article: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/blog/create
router.post('/create', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ success: false, error: 'Non autorisé' });
  }

  try {
    const { slug, titre, introduction, contenu, image_url, categorie, tags, publie } = req.body;

    const { data, error } = await supabase
      .from('articles')
      .upsert({
        slug,
        titre,
        introduction,
        contenu,
        image_url,
        categorie,
        tags: tags || [],
        publie: publie || false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'slug' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, article: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;