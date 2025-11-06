/**
 * API Endpoint: /api/trial/increment
 * Incrémente le compteur de générations pour un HWID
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

        // Vérifier si HWID valide
        if (!hwid.startsWith('HWID-')) {
            return res.status(400).json({
                error: 'Invalid HWID',
                message: 'Format HWID invalide'
            });
        }

        // Récupérer le client Redis
        const client = await getRedisClient();

        // Récupérer le compteur actuel
        const key = `trial:${hwid}`;
        const value = await client.get(key);
        let generationsUsed = value ? parseInt(value, 10) : 0;

        // Vérifier si limite dépassée
        if (generationsUsed >= FREE_GENERATIONS_LIMIT) {
            return res.status(403).json({
                error: 'Trial limit reached',
                message: 'Limite de générations gratuites atteinte',
                generationsUsed: generationsUsed,
                generationsLimit: FREE_GENERATIONS_LIMIT,
                generationsRemaining: 0
            });
        }

        // Incrémenter le compteur
        generationsUsed++;
        await client.set(key, generationsUsed.toString());

        // Logger pour analytics (optionnel)
        console.log(`✓ HWID ${hwid.substring(0, 20)}... → ${generationsUsed}/${FREE_GENERATIONS_LIMIT}`);

        // Retourner le nouveau statut
        return res.status(200).json({
            success: true,
            generationsUsed: generationsUsed,
            generationsLimit: FREE_GENERATIONS_LIMIT,
            generationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - generationsUsed)
        });

    } catch (error) {
        console.error('Erreur /api/trial/increment:', error);

        return res.status(500).json({
            error: 'Internal server error',
            message: 'Erreur serveur lors de l\'incrémentation',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
