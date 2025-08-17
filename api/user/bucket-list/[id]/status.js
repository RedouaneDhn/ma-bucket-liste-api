// api/user/bucket-list/[id]/status.js
import { supabase } from '../../../lib/supabase.js';
import { verifyToken } from '../../../lib/auth.js';

export default async function handler(req, res) {
    // Configurer CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'PUT') {
        return res.status(405).json({
            success: false,
            error: 'Méthode non autorisée'
        });
    }

    try {
        // Vérifier l'authentification
        const user = await verifyToken(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Token invalide ou expiré'
            });
        }

        // Récupérer l'ID de l'activité depuis l'URL
        const { id: activityId } = req.query;
        const { status } = req.body;

        // Validation de l'ID
        if (!activityId) {
            return res.status(400).json({
                success: false,
                error: 'ID de l\'activité requis'
            });
        }

        // Validation du statut
        const validStatuses = ['planned', 'in_progress', 'completed'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Statut invalide. Valeurs autorisées: planned, in_progress, completed'
            });
        }

        console.log(`🔄 Mise à jour statut activité ${activityId} vers ${status} pour user ${user.id}`);

        // Vérifier que l'activité appartient bien à l'utilisateur
        const { data: existingActivity, error: checkError } = await supabase
            .from('user_bucket_list')
            .select('id, activity_id, status')
            .eq('id', activityId)
            .eq('user_id', user.id)
            .single();

        if (checkError || !existingActivity) {
            console.error('❌ Activité non trouvée:', checkError);
            return res.status(404).json({
                success: false,
                error: 'Activité non trouvée dans votre bucket liste'
            });
        }

        // Préparer les données de mise à jour
        const updateData = {
            status: status,
            updated_at: new Date().toISOString()
        };

        // Si marqué comme completed, ajouter la date de completion
        if (status === 'completed') {
            updateData.completed_date = new Date().toISOString();
        } else {
            // Si ce n'est plus completed, supprimer la date de completion
            updateData.completed_date = null;
        }

        // Mettre à jour le statut dans Supabase
        const { data: updatedActivity, error: updateError } = await supabase
            .from('user_bucket_list')
            .update(updateData)
            .eq('id', activityId)
            .eq('user_id', user.id)
            .select(`
                id,
                status,
                completed_date,
                created_at,
                updated_at,
                activities:activity_id (
                    id,
                    title,
                    description,
                    slug,
                    category,
                    location,
                    rating
                )
            `)
            .single();

        if (updateError) {
            console.error('❌ Erreur mise à jour:', updateError);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour du statut'
            });
        }

        // Formater la réponse pour correspondre au format attendu par le frontend
        const formattedActivity = {
            id: updatedActivity.id,
            title: updatedActivity.activities.title,
            description: updatedActivity.activities.description,
            slug: updatedActivity.activities.slug,
            category: updatedActivity.activities.category,
            location: updatedActivity.activities.location,
            rating: updatedActivity.activities.rating,
            status: updatedActivity.status,
            added_date: updatedActivity.created_at?.split('T')[0],
            completed_date: updatedActivity.completed_date?.split('T')[0],
            updated_at: updatedActivity.updated_at
        };

        console.log(`✅ Statut mis à jour avec succès: ${activityId} → ${status}`);

        // Log pour les analytics (optionnel)
        if (status === 'completed') {
            console.log(`🎉 Nouvelle activité complétée par user ${user.id}: ${updatedActivity.activities.title}`);
        }

        return res.status(200).json({
            success: true,
            message: `Statut mis à jour vers "${status}"`,
            activity: formattedActivity,
            previousStatus: existingActivity.status
        });

    } catch (error) {
        console.error('❌ Erreur serveur:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur interne du serveur'
        });
    }
}