/**
 * API Endpoint: /api/updates/manifest
 * Retourne le manifest de mise à jour (liste des fichiers disponibles)
 *
 * GET Response: {
 *   version: string,
 *   releaseDate: string,
 *   files: [{path, url, checksum}]
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
        // IMPORTANT: Modifier cette configuration à chaque nouvelle version
        // Calculez les checksums avec: shasum -a 256 fichier.js
        const manifest = {
            version: '1.0.1',  // Version actuelle (même que /api/version/latest)
            releaseDate: '2025-11-08',
            changelog: [
                '🧪 Test mise à jour automatique - Fond vert'
            ],
            files: [
                {
                    path: 'css/styles.css',
                    url: 'https://logotyps.vercel.app/api/updates/files?file=styles.css',
                    checksum: '9a5f0b7c8873fec77be8793391e8cadd506b2baea97bf34f76f0825ec73f00ef'
                },
                {
                    path: 'js/updater.js',
                    url: 'https://logotyps.vercel.app/api/updates/files?file=updater.js',
                    checksum: 'cd9b5463d550f84740939dce854bfa71ddc5a7d163bb02c77f0a6356a9df38e5'
                }
            ]
        };

        return res.status(200).json(manifest);

    } catch (error) {
        console.error('Erreur /api/updates/manifest:', error);

        return res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
}
