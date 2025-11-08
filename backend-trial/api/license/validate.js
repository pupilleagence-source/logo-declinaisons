/**
 * API Endpoint: /api/license/validate
 * Valide une licence existante
 *
 * POST Body: { hwid: string }
 * Response: { valid: boolean, licenseType: string }
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
                valid: false,
                message: 'HWID manquant'
            });
        }

        // Récupérer la licence depuis Redis
        const client = await getRedisClient();
        const licenseData = await client.get(`license:${hwid}`);

        if (!licenseData) {
            return res.status(200).json({
                valid: false,
                message: 'Aucune licence trouvée pour ce HWID'
            });
        }

        const license = JSON.parse(licenseData);

        // Vérifier avec Lemon Squeezy (validation périodique)
        try {
            const lemonSqueezyResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    license_key: license.licenseKey,
                    instance_name: hwid
                })
            });

            const lemonData = await lemonSqueezyResponse.json();

            // Si la licence n'est plus valide côté Lemon Squeezy
            if (!lemonData.valid) {
                // Supprimer de Redis
                await client.del(`license:${hwid}`);

                return res.status(200).json({
                    valid: false,
                    message: 'Licence révoquée ou expirée'
                });
            }

            // Mettre à jour les données dans Redis
            license.lastValidated = Date.now();
            license.lemonSqueezyData = lemonData;
            await client.set(`license:${hwid}`, JSON.stringify(license));

            console.log(`✓ Licence validée: ${hwid.substring(0, 20)}... (${license.licenseType})`);

            return res.status(200).json({
                valid: true,
                licenseType: license.licenseType,
                email: license.email,
                activatedAt: license.activatedAt
            });

        } catch (lemonError) {
            // Si Lemon Squeezy est inaccessible, utiliser le cache Redis
            console.warn('⚠️ Lemon Squeezy inaccessible, utilisation du cache:', lemonError.message);

            // Vérifier si le cache n'est pas trop vieux (7 jours max)
            const cacheAge = Date.now() - (license.lastValidated || license.activatedAt);
            const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 jours

            if (cacheAge > maxCacheAge) {
                return res.status(200).json({
                    valid: false,
                    message: 'Cache expiré, connexion Internet requise pour valider la licence'
                });
            }

            // Cache encore valide
            return res.status(200).json({
                valid: true,
                licenseType: license.licenseType,
                email: license.email,
                activatedAt: license.activatedAt,
                offline: true
            });
        }

    } catch (error) {
        console.error('Erreur /api/license/validate:', error);

        return res.status(500).json({
            valid: false,
            message: 'Erreur serveur lors de la validation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
