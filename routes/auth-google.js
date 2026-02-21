const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://api.mabucketliste.fr/api/auth/google/callback'
);

// GET /api/auth/google — Redirige vers Google
router.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'select_account'
  });
  res.redirect(url);
});

// GET /api/auth/google/callback — Google rappelle ici
router.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  // Erreur ou refus de l'utilisateur
  if (error || !code) {
    return res.redirect('https://www.mabucketliste.fr/connexion.html?error=google_cancelled');
  }

  try {
    // 1. Échanger le code contre les tokens Google
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 2. Récupérer les infos utilisateur Google
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const firstName = payload.given_name || '';
    const lastName = payload.family_name || '';
    const avatarUrl = payload.picture || null;

    // 3. Chercher l'utilisateur existant dans Supabase
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    let userId;

    if (existingUser) {
      // Utilisateur existant → on récupère son ID
      userId = existingUser.user_id;

      // Mettre à jour l'avatar si pas encore défini
      if (!existingUser.avatar_url && avatarUrl) {
        await supabase
          .from('user_profiles')
          .update({ avatar_url: avatarUrl, google_id: googleId })
          .eq('user_id', userId);
      }

   } else {
    // Email existe dans Supabase Auth mais pas dans user_profiles
    // → Récupérer l'utilisateur existant via son email
    const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserByEmail(email);

    if (getUserError || !authUser) {
        // Vraiment nouvel utilisateur → créer
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { firstName, lastName, provider: 'google' }
        });
        if (authError) throw authError;
        userId = authData.user.id;
    } else {
        // Utilisateur existant (email/password) → récupérer son ID
        userId = authUser.user.id;
    }

    // Créer le profil dans tous les cas
    await supabase.from('user_profiles').upsert([{
        user_id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
        google_id: googleId,
        created_at: new Date().toISOString()
    }], { onConflict: 'user_id' });
}

    // 4. Générer un JWT compatible avec le système existant
    const jwtToken = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Rediriger vers le frontend avec le token
    const userData = encodeURIComponent(JSON.stringify({
      id: userId,
      email,
      firstName,
      lastName,
      avatarUrl
    }));

    res.redirect(
      `https://www.mabucketliste.fr/connexion.html?token=${jwtToken}&user=${userData}&provider=google`
    );

  } catch (err) {
    console.error('[GOOGLE AUTH] Erreur:', err.message);
    res.redirect('https://www.mabucketliste.fr/connexion.html?error=google_failed');
  }
});

module.exports = router;