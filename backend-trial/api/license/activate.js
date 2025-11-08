/**
 * API Endpoint: /api/license/activate
 * Active une licence Lemon Squeezy
 *
 * POST Body: { licenseKey: string, email: string, hwid: string }
 * Response: { success: boolean, licenseType: string }
 */

import { createClient } from 'redis';

// IDs des variantes Lemon Squeezy
const VARIANT_IDS = {
    LIFETIME: 1077127,
    MONTHLY: 1077121
};

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
        const { licenseKey, email, hwid } = req.body;

        // Validation des paramètres
        if (!licenseKey || !email || !hwid) {
            return res.status(400).json({
                success: false,
                message: 'Paramètres manquants (licenseKey, email, hwid requis)'
            });
        }

        // Valider la licence avec Lemon Squeezy
        const lemonSqueezyResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                license_key: licenseKey,
                instance_name: hwid
            })
        });

        const lemonData = await lemonSqueezyResponse.json();

        console.log('Lemon Squeezy validation response:', JSON.stringify(lemonData, null, 2));

        // Vérifier la réponse
        if (!lemonData.valid) {
            return res.status(400).json({
                success: false,
                message: lemonData.error || 'Clé de licence invalide'
            });
        }

        // Vérifier si la licence est activée et récupérer l'instance_id
        let instanceId = null;

        if (!lemonData.activated) {
            // Activer la licence pour ce HWID
            const activateResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    license_key: licenseKey,
                    instance_name: hwid
                })
            });

            const activateData = await activateResponse.json();

            console.log('Lemon Squeezy activation response:', JSON.stringify(activateData, null, 2));

            if (!activateData.activated) {
                return res.status(400).json({
                    success: false,
                    message: activateData.error || 'Impossible d\'activer la licence'
                });
            }

            // IMPORTANT: Récupérer l'instance_id depuis l'activation
            instanceId = activateData.instance?.id;
        } else {
            // Licence déjà activée, récupérer l'instance_id depuis la validation
            instanceId = lemonData.instance?.id;
        }

        console.log(`Instance ID: ${instanceId || 'NON TROUVÉ'}`);

        // Déterminer le type de licence basé sur le variant_id
        const variantId = lemonData.meta?.variant_id;
        let licenseType = 'unknown';

        if (variantId === VARIANT_IDS.LIFETIME) {
            licenseType = 'lifetime';
        } else if (variantId === VARIANT_IDS.MONTHLY) {
            licenseType = 'monthly';
        }

        // Stocker la licence activée dans Redis avec l'instance_id
        const client = await getRedisClient();
        const licenseData = {
            licenseKey: licenseKey,
            email: email,
            hwid: hwid,
            licenseType: licenseType,
            variantId: variantId,
            instanceId: instanceId, // Instance ID récupéré depuis l'activation ou la validation
            activatedAt: Date.now(),
            lemonSqueezyData: lemonData
        };

        await client.set(`license:${hwid}`, JSON.stringify(licenseData));

        console.log(`✓ Licence activée: ${licenseKey.substring(0, 10)}... → ${hwid.substring(0, 20)}... (${licenseType})`);

        // Retourner le succès
        return res.status(200).json({
            success: true,
            licenseType: licenseType,
            message: 'Licence activée avec succès'
        });

    } catch (error) {
        console.error('Erreur /api/license/activate:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de l\'activation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
