/**
 * API Endpoint: /api/trial/check
 * Vérifie le statut trial d'un HWID
 *
 * POST Body: { hwid: "HWID-xxx..." }
 * Response: { generationsUsed: number, generationsLimit: number }
 */

import { createClient } from 'redis';

// Configuration
const FREE_GENERATIONS_LIMIT = 7;

// Créer le client Redis avec les variables d'environnement Vercel
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
    // CORS headers pour permettre les requêtes depuis CEP Extension
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
        if (!hwid || typeof hwid !== 'string') {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'HWID manquant ou invalide'
            });
        }

        // Vérifier si HWID valide (commence par HWID-)
        if (!hwid.startsWith('HWID-')) {
            return res.status(400).json({
                error: 'Invalid HWID',
                message: 'Format HWID invalide'
            });
        }

        // Récupérer le client Redis
        const client = await getRedisClient();

        // Récupérer le compteur depuis Redis
        const key = `trial:${hwid}`;
        const value = await client.get(key);
        let generationsUsed = value ? parseInt(value, 10) : 0;

        // Si pas encore enregistré, initialiser à 0
        if (value === null) {
            generationsUsed = 0;
            await client.set(key, '0');
        }

        // Retourner le statut
        return res.status(200).json({
            success: true,
            generationsUsed: generationsUsed,
            generationsLimit: FREE_GENERATIONS_LIMIT,
            generationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - generationsUsed)
        });

    } catch (error) {
        console.error('Erreur /api/trial/check:', error);

        return res.status(500).json({
            error: 'Internal server error',
            message: 'Erreur serveur lors de la vérification du trial',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
