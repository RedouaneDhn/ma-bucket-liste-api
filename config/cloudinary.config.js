/**
 * Configuration Cloudinary pour Ma Bucket Liste
 * 
 * Ce fichier configure le SDK Cloudinary côté serveur
 * pour la génération d'images de partage social
 */

const cloudinary = require('cloudinary').v2;

// Configuration avec les variables d'environnement
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwly55oxx',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Validation de la configuration
const validateConfig = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  
  if (!cloud_name || !api_key || !api_secret) {
    console.error('❌ Configuration Cloudinary incomplète');
    console.error('Variables manquantes:', {
      cloud_name: !!cloud_name,
      api_key: !!api_key,
      api_secret: !!api_secret
    });
    return false;
  }
  
  console.log('✅ Configuration Cloudinary OK:', cloud_name);
  return true;
};

// Valider au démarrage
validateConfig();

module.exports = cloudinary;