// routes/user-profile.js - Endpoints API Profil Utilisateur
const express = require('express');
const multer = require('multer');
const { put, del } = require('@vercel/blob');
const { supabase } = require('../config/supabase');
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'accès requis'
      });
    }

    const { supabase } = require('../config/supabase');
    const { data: user, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide'
      });
    }

    req.user = user.user;
    req.userId = user.user.id;
    next();
  } catch (error) {
    console.error('Erreur authentification:', error);
    res.status(403).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

const router = express.Router();

// Configuration Multer pour upload fichiers (mémoire)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement les images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés'), false);
    }
  }
});

/**
 * GET /api/user/profile
 * Récupérer le profil de l'utilisateur connecté
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer les données profil uniquement
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, avatar_url, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Profil utilisateur non trouvé'
        });
      }
      throw error;
    }

    // Format de réponse standardisé
    res.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at
      }
    });

  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du profil'
    });
  }
});

/**
 * PUT /api/user/profile
 * Mettre à jour les informations personnelles (nom, prénom, email)
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email } = req.body;

    // Validation des données
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nom, prénom et email sont requis'
      });
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email invalide'
      });
    }

    // Vérifier si l'email n'est pas déjà utilisé par un autre utilisateur
    if (email !== req.user.email) {
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
      }
    }

    // Mise à jour du profil
    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.toLowerCase().trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, first_name, last_name, avatar_url, created_at')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        firstName: updatedProfile.first_name,
        lastName: updatedProfile.last_name,
        avatarUrl: updatedProfile.avatar_url,
        createdAt: updatedProfile.created_at
      }
    });

  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour'
    });
  }
});

/**
 * POST /api/user/avatar
 * Upload de l'avatar utilisateur vers Vercel Blob Storage
 */
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // Générer nom de fichier unique
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `avatars/${userId}-${Date.now()}.${fileExtension}`;

    // Récupérer l'ancien avatar pour le supprimer
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    // Upload vers Vercel Blob Storage
    const blob = await put(fileName, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });

    // Mettre à jour l'URL de l'avatar en base
    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update({
        avatar_url: blob.url,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('avatar_url')
      .single();

    if (error) throw error;

    // Supprimer l'ancien avatar s'il existait
    if (currentProfile?.avatar_url) {
      try {
        const oldFileName = currentProfile.avatar_url.split('/').pop();
        await del(`avatars/${oldFileName}`);
      } catch (deleteError) {
        console.warn('Erreur suppression ancien avatar:', deleteError);
      }
    }

    res.json({
      success: true,
      message: 'Avatar mis à jour avec succès',
      avatarUrl: updatedProfile.avatar_url
    });

  } catch (error) {
    console.error('Erreur upload avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'avatar'
    });
  }
});

/**
 * DELETE /api/user/avatar
 * Supprimer l'avatar utilisateur
 */
router.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer l'URL actuelle de l'avatar
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (!currentProfile?.avatar_url) {
      return res.status(404).json({
        success: false,
        message: 'Aucun avatar à supprimer'
      });
    }

    // Supprimer l'avatar de Vercel Blob Storage
    try {
      const fileName = currentProfile.avatar_url.split('/').pop();
      await del(`avatars/${fileName}`);
    } catch (deleteError) {
      console.warn('Erreur suppression fichier:', deleteError);
    }

    // Mettre à jour la base pour supprimer l'URL
    const { error } = await supabase
      .from('user_profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Avatar supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'avatar'
    });
  }
});

module.exports = router;