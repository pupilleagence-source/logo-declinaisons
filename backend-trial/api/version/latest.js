/**
 * API Endpoint: /api/version/latest
 * Retourne la dernière version disponible du plugin
 *
 * GET Response: {
 *   version: string,
 *   releaseDate: string,
 *   downloadUrl: string,
 *   changelog: string[]
 * }
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Utilisez GET pour cet endpoint'
        });
    }

    try {
        // Configuration de la dernière version
        // TODO: Vous pourrez mettre à jour ces valeurs à chaque nouvelle release
        const latestVersion = {
            version: '1.0.0',
            releaseDate: '2025-11-07',
            downloadUrl: 'https://votre-domaine.com/downloads/logo-declinaisons-v1.0.0.zxp',
            changelog: [
                'Version initiale',
                'Système de génération de déclinaisons',
                'Trial gratuit (7 générations)',
                'Système de licences Lemon Squeezy'
            ]
        };

        return res.status(200).json(latestVersion);

    } catch (error) {
        console.error('Erreur /api/version/latest:', error);

        return res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
}
