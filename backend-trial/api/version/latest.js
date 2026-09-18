/**
 * API Endpoint: /api/version/latest
 * Retourne la dernière version disponible du plugin.
 * Sert AUSSI /api/download (route vercel.json -> ?download=1) : voir lib/download.js,
 * et /api/checkout (-> ?checkout=1) : voir lib/checkout.js.
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
import { handleCheckout } from '../../lib/checkout.js';

// Dernière version publiée. Bumpée par scripts/release.js (version, releaseDate,
// changelog) ; lue aussi par lib/download.js pour construire l'URL de l'installeur.
// downloadUrl : page de téléchargement du site, montrée par les clients ≤ 1.3.0.
export const LATEST = {
            version: '1.4.4',
            releaseDate: '2026-09-18',
            downloadUrl: 'https://logotyps.fr/download',
            changelog: [
            "Le plugin s'appelle désormais Logotyps dans Fenêtre > Extensions",
            "Génération fiable sur les postes verrouillés (Citrix, sécurité d'entreprise) : plus de passage par le presse-papiers",
            "Message d'erreur précis si un élément ne peut pas être transféré",
            "Bouton Désactiver et badge de licence corrigés"
        ]
};

export default async function handler(req, res, deps) {
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
    // /api/checkout (checkout Lemon Squeezy, plan présélectionné), routé ici aussi.
    if (req.query && String(req.query.checkout) === '1') {
        return handleCheckout(req, res, deps);
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
