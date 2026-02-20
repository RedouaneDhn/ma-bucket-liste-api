// verify-cloudinary-images.js
// Script de vérification des images Cloudinary vs Supabase

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;

// Configuration
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function verifyAllImages() {
  console.log('🔍 VÉRIFICATION DES IMAGES CLOUDINARY\n');
  console.log('=====================================\n');

  try {
    // 1. Récupérer toutes les images depuis Supabase
    const { data: dbImages, error } = await supabase
      .from('activity_images')
      .select(`
        id,
        activity_id,
        cloudinary_public_id,
        image_type,
        activity:activities(title)
      `)
      .eq('image_type', 'hero');

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      return;
    }

    console.log(`📊 ${dbImages.length} images trouvées dans Supabase\n`);

    const results = {
      valid: [],
      invalid: [],
      missing: []
    };

    // 2. Vérifier chaque image sur Cloudinary
    for (const img of dbImages) {
      const publicId = img.cloudinary_public_id;
      const activityTitle = img.activity?.title || 'Sans titre';

      if (!publicId) {
        results.missing.push({
          id: img.id,
          activity_id: img.activity_id,
          title: activityTitle,
          reason: 'Pas de cloudinary_public_id'
        });
        continue;
      }

      try {
        // Vérifier si l'image existe sur Cloudinary
        const cloudinaryImage = await cloudinary.api.resource(publicId, {
          type: 'upload',
          resource_type: 'image'
        });

        results.valid.push({
          id: img.id,
          activity_id: img.activity_id,
          title: activityTitle,
          publicId: publicId,
          cloudinaryPublicId: cloudinaryImage.public_id,
          match: publicId === cloudinaryImage.public_id
        });

        console.log(`✅ ${activityTitle}`);
        console.log(`   DB: ${publicId}`);
        if (publicId !== cloudinaryImage.public_id) {
          console.log(`   ⚠️  Cloudinary: ${cloudinaryImage.public_id} (DIFFÉRENT!)`);
        }
        console.log('');

      } catch (cloudinaryError) {
        // Meilleure gestion des erreurs Cloudinary
        const is404 = 
          cloudinaryError.http_code === 404 || 
          cloudinaryError.error?.http_code === 404 ||
          (cloudinaryError.error && cloudinaryError.error.message && cloudinaryError.error.message.includes('not found')) ||
          (cloudinaryError.message && cloudinaryError.message.toLowerCase().includes('not found'));

        if (is404) {
          results.invalid.push({
            id: img.id,
            activity_id: img.activity_id,
            title: activityTitle,
            publicId: publicId,
            reason: 'Image introuvable sur Cloudinary'
          });

          console.log(`❌ ${activityTitle}`);
          console.log(`   DB: ${publicId}`);
          console.log(`   Cloudinary: IMAGE INTROUVABLE\n`);
        } else {
          // Autre erreur (rate limit, API key, etc.)
          console.error(`⚠️  Erreur API pour ${activityTitle}:`);
          console.error(`   Message:`, cloudinaryError.message || 'Erreur inconnue');
          console.error(`   Code:`, cloudinaryError.http_code || cloudinaryError.error?.http_code || 'N/A');
          
          // Ne pas compter comme invalide, juste logger
          console.log('');
        }
      }

      // Pause plus longue pour éviter le rate limiting Cloudinary
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Afficher le résumé
    console.log('\n=====================================');
    console.log('📊 RÉSUMÉ DE LA VÉRIFICATION\n');
    console.log(`✅ Images valides: ${results.valid.length}`);
    console.log(`❌ Images introuvables: ${results.invalid.length}`);
    console.log(`⚠️  Images sans cloudinary_public_id: ${results.missing.length}`);
    console.log('=====================================\n');

    // 4. Détails des problèmes
    if (results.invalid.length > 0) {
      console.log('\n❌ IMAGES INTROUVABLES SUR CLOUDINARY:\n');
      results.invalid.forEach(img => {
        console.log(`- ${img.title}`);
        console.log(`  ID en base: ${img.publicId}`);
        console.log(`  Activity ID: ${img.activity_id}`);
        console.log(`  Image ID: ${img.id}\n`);
      });
    }

    if (results.missing.length > 0) {
      console.log('\n⚠️  ACTIVITÉS SANS cloudinary_public_id:\n');
      results.missing.forEach(img => {
        console.log(`- ${img.title}`);
        console.log(`  Activity ID: ${img.activity_id}`);
        console.log(`  Image ID: ${img.id}\n`);
      });
    }

    // 5. Suggestions de correction
    if (results.invalid.length > 0) {
      console.log('\n💡 SUGGESTIONS DE CORRECTION:\n');
      console.log('1. Vérifiez les noms sur Cloudinary Console:');
      console.log('   https://console.cloudinary.com/console/c-YOUR_CLOUD/media_library\n');
      console.log('2. Corrigez dans Supabase avec:');
      console.log('   UPDATE activity_images');
      console.log('   SET cloudinary_public_id = \'nom-correct\'');
      console.log('   WHERE id = image_id;\n');
      console.log('3. OU renommez sur Cloudinary pour correspondre à la base');
    }

    // 6. Sauvegarder le rapport
    const report = {
      date: new Date().toISOString(),
      total: dbImages.length,
      valid: results.valid.length,
      invalid: results.invalid.length,
      missing: results.missing.length,
      details: {
        valid: results.valid,
        invalid: results.invalid,
        missing: results.missing
      }
    };

    const fs = require('fs');
    fs.writeFileSync(
      'cloudinary-verification-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n📄 Rapport sauvegardé dans: cloudinary-verification-report.json\n');

  } catch (error) {
    console.error('❌ Erreur globale:', error);
  }
}

// Lancer la vérification
verifyAllImages()
  .then(() => {
    console.log('✅ Vérification terminée');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });