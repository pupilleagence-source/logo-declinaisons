/**
 * API Endpoint: /api/version/latest
 * Retourne la dernière version disponible du plugin.
 * Sert AUSSI /api/download (route vercel.json -> ?download=1) : voir lib/download.js.
 * Plan Vercel Hobby = 12 fonctions max, toutes prises : pas de fonction dédiée.
 *
 * GET Response: {
 *   version: string,
 *   releaseDate: string,
 *   downloadUrl: string,   // page de téléchargement du site (clients ≤ 1.3.0)
 *   changelog: string[]
 * }
 */

import { handleDownload } from '../../lib/download.js';

// Dernière version publiée. Bumpée par scripts/release.js (version, releaseDate,
// changelog) ; lue aussi par lib/download.js pour construire l'URL de l'installeur.
// downloadUrl : page de téléchargement du site, montrée par les clients ≤ 1.3.0.
export const LATEST = {
            version: '1.4.1',
            releaseDate: '2026-09-10',
            downloadUrl: 'https://logotyps.fr/update',
            changelog: [
            "⬇️ Téléchargement direct de l'installeur depuis le panneau, sans passer par GitHub",
            "🔑 Changement de poste après une mise à jour d'Illustrator : l'ancienne activation est libérée automatiquement",
            "🌐 Page de téléchargement : logotyps.fr/update"
        ]
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // /api/download (redirection vers l'installeur), routé ici par vercel.json.
    if (req.query && String(req.query.download) === '1') {
        return handleDownload(req, res, LATEST);
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Utilisez GET pour cet endpoint'
        });
    }

    try {
        return res.status(200).json(LATEST);

    } catch (error) {
        console.error('Erreur /api/version/latest:', error);

        return res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
}
