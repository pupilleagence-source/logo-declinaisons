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
            version: '1.4.0',
            releaseDate: '2026-09-07',
            downloadUrl: 'https://github.com/pupilleagence-source/logo-declinaisons-releases/releases/latest',
            changelog: [
            "🔄 Mise à jour à chaud : les prochaines versions s'installent directement depuis le panneau, sans réinstaller",
            "📦 Deux modales de mise à jour : installation directe, ou passage par l'installeur quand c'est nécessaire",
            "🍎 macOS : le dossier du plugin appartient désormais à l'utilisateur (nécessaire à la mise à jour à chaud)",
            "🔔 Rappel de relancer Illustrator après une mise à jour"
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
