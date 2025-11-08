/**
 * API Endpoint: /api/license/deactivate
 * Désactive une licence sur un appareil
 *
 * POST Body: { licenseKey: string, hwid: string }
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
            success: false,
            message: 'Utilisez POST pour cet endpoint'
        });
    }

    try {
        const { licenseKey, hwid } = req.body;

        // Validation
        if (!licenseKey || !hwid) {
            return res.status(400).json({
                success: false,
                message: 'Paramètres manquants (licenseKey et hwid requis)'
            });
        }

        // Récupérer l'instance_id depuis Redis
        const client = await getRedisClient();
        const storedLicenseData = await client.get(`license:${hwid}`);

        if (!storedLicenseData) {
            return res.status(404).json({
                success: false,
                message: 'Aucune licence trouvée pour cet appareil'
            });
        }

        const licenseData = JSON.parse(storedLicenseData);
        const instanceId = licenseData.instanceId;

        if (!instanceId) {
            console.error('Instance ID manquant dans les données stockées');
            return res.status(400).json({
                success: false,
                message: 'Instance ID manquant. Veuillez réactiver votre licence.'
            });
        }

        // Désactiver la licence via Lemon Squeezy avec l'instance_id
        const lemonSqueezyResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                license_key: licenseKey,
                instance_id: instanceId
            })
        });

        const lemonData = await lemonSqueezyResponse.json();

        console.log('Lemon Squeezy deactivation response:', JSON.stringify(lemonData, null, 2));
        console.log('Lemon Squeezy HTTP status:', lemonSqueezyResponse.status);

        // Vérifier si la réponse est OK même si pas de champ "deactivated"
        if (!lemonSqueezyResponse.ok || (!lemonData.deactivated && lemonData.error)) {
            console.error('Échec désactivation:', lemonData);
            return res.status(400).json({
                success: false,
                message: lemonData.error || 'Impossible de désactiver la licence',
                details: process.env.NODE_ENV === 'development' ? lemonData : undefined
            });
        }

        // Supprimer la licence de Redis
        const deleted = await client.del(`license:${hwid}`);

        console.log(`✓ Licence désactivée: ${licenseKey.substring(0, 10)}... → ${hwid.substring(0, 20)}...`);

        return res.status(200).json({
            success: true,
            message: 'Licence désactivée avec succès',
            deleted: deleted > 0
        });

    } catch (error) {
        console.error('Erreur /api/license/deactivate:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la désactivation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
