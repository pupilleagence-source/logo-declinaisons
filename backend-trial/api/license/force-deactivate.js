/**
 * API Endpoint: /api/license/force-deactivate
 * Désactive une licence de force (sans passer par Lemon Squeezy)
 * Utilisé pour les cas où l'instance_id n'est pas stocké
 *
 * POST Body: { hwid: string }
 * Response: { success: boolean, message: string }
 */

import { createClient } from 'redis';

// Créer le client Redis
let redis = null;

async function getRedisClient() {
    if (!redis) {
        redis = createClient({
            url: process.env.KV_URL || process.env.REDIS_URL
        });
        await redis.connect();
    }
    return redis;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Accepter uniquement POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Utilisez POST pour cet endpoint'
        });
    }

    try {
        const { hwid } = req.body;

        // Validation
        if (!hwid) {
            return res.status(400).json({
                success: false,
                message: 'HWID requis'
            });
        }

        const client = await getRedisClient();

        // IMPORTANT: Récupérer les infos de licence AVANT de supprimer
        // Pour pouvoir libérer le slot Lemon Squeezy
        const storedLicenseData = await client.get(`license:${hwid}`);

        if (storedLicenseData) {
            try {
                const licenseData = JSON.parse(storedLicenseData);
                const { licenseKey, instanceId } = licenseData;

                // Essayer de désactiver sur Lemon Squeezy pour libérer le slot
                if (licenseKey && instanceId) {
                    console.log(`🔓 Tentative libération slot Lemon Squeezy: ${licenseKey.substring(0, 10)}...`);

                    const lemonResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
                        },
                        body: JSON.stringify({
                            license_key: licenseKey,
                            instance_id: instanceId
                        })
                    });

                    if (lemonResponse.ok) {
                        console.log(`✅ Slot Lemon Squeezy libéré: ${licenseKey.substring(0, 10)}...`);
                    } else {
                        const errorData = await lemonResponse.json();
                        console.warn(`⚠️ Échec libération slot Lemon Squeezy:`, errorData);
                    }
                } else {
                    console.warn('⚠️ Impossible de libérer le slot: licenseKey ou instanceId manquant');
                }
            } catch (lemonError) {
                console.warn('⚠️ Erreur lors de la désactivation Lemon Squeezy:', lemonError.message);
                // Continue quand même pour supprimer de Redis
            }
        }

        // Supprimer la licence de Redis dans tous les cas
        const deleted = await client.del(`license:${hwid}`);

        console.log(`✓ FORCE DEACTIVATE: HWID ${hwid.substring(0, 20)}... → Licence supprimée${deleted > 0 ? ' de Redis' : ' (non trouvée)'}`);

        return res.status(200).json({
            success: true,
            message: 'Licence désactivée avec succès',
            deleted: deleted > 0
        });

    } catch (error) {
        console.error('Erreur /api/license/force-deactivate:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la désactivation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
