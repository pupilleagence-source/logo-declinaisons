/**
 * API Endpoint: /api/trial/increment
 * Incrémente le compteur de générations pour un HWID
 *
 * POST Body: { hwid: "HWID-xxx..." }
 * Response: { generationsUsed: number, generationsLimit: number }
 */

import { kv } from '@vercel/kv';

// Configuration
const FREE_GENERATIONS_LIMIT = 7;

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

        // Récupérer le compteur actuel
        const key = `trial:${hwid}`;
        let generationsUsed = await kv.get(key);

        // Si pas encore enregistré, initialiser à 0
        if (generationsUsed === null) {
            generationsUsed = 0;
        }

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
        await kv.set(key, generationsUsed);

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
            message: 'Erreur serveur lors de l\'incrémentation'
        });
    }
}
