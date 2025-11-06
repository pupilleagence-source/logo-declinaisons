/**
 * API Endpoint: /api/trial/reset
 * DÉVELOPPEMENT SEULEMENT - Réinitialise le compteur pour un HWID
 *
 * POST Body: { hwid: "HWID-xxx..." }
 * Response: { success: boolean, message: string }
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

        // Vérifier si HWID valide
        if (!hwid.startsWith('HWID-')) {
            return res.status(400).json({
                error: 'Invalid HWID',
                message: 'Format HWID invalide'
            });
        }

        // Récupérer le client Redis
        const client = await getRedisClient();

        // Supprimer la clé dans Redis
        const key = `trial:${hwid}`;
        const deleted = await client.del(key);

        // Logger pour debug
        console.log(`🔄 RESET TRIAL: HWID ${hwid.substring(0, 20)}... → Clé supprimée (${deleted} clé(s))`);

        // Retourner le résultat
        return res.status(200).json({
            success: true,
            message: 'Compteur trial réinitialisé avec succès',
            hwid: hwid.substring(0, 20) + '...',
            deleted: deleted > 0,
            newLimit: FREE_GENERATIONS_LIMIT
        });

    } catch (error) {
        console.error('Erreur /api/trial/reset:', error);

        return res.status(500).json({
            error: 'Internal server error',
            message: 'Erreur serveur lors de la réinitialisation',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
