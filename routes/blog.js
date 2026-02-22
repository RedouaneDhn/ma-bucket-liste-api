const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
router.get('/share', async (req, res) => {
    const { slug } = req.query;
    if (!slug) return res.redirect('/blog/index.html');

    try {
        const { data, error } = await supabase
            .from('articles')
            .select('titre, introduction, image_url, slug')
            .eq('slug', slug)
            .eq('publie', true)
            .single();

        if (error || !data) return res.redirect('/blog/index.html');

        const articleUrl = `https://www.mabucketliste.fr/blog/article.html?slug=${slug}`;
        const image = data.image_url || 'https://www.mabucketliste.fr/assets/img/activities/blog-hero2.jpg';

        res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${data.titre} - Ma Bucket Liste</title>
    <meta name="description" content="${data.introduction || ''}">
    <meta property="og:title" content="${data.titre} - Ma Bucket Liste">
    <meta property="og:description" content="${data.introduction || ''}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${articleUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Ma Bucket Liste">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${data.titre} - Ma Bucket Liste">
    <meta name="twitter:description" content="${data.introduction || ''}">
    <meta name="twitter:image" content="${image}">
    <meta http-equiv="refresh" content="0;url=${articleUrl}">
</head>
<body>
    <script>window.location.href = "${articleUrl}";</script>
</body>
</html>`);
    } catch (error) {
        res.redirect('/blog/index.html');
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