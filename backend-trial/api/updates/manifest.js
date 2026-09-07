/**
 * API Endpoint: /api/updates/manifest
 *
 * Sert le manifeste de mise à jour à chaud tel que généré ET SIGNÉ par
 * scripts/release.js (fichier updates/manifest.json du déploiement). Rien n'est
 * calculé ici : ce handler ne fait que relire le fichier.
 *
 * GET -> 200 { version, releaseDate, changelog, hotUpdateFrom, assetsFingerprint,
 *              restartRequired, files: [{ path, sha256, size }], signature }
 *     -> 404 tant qu'aucune release n'a produit de manifeste.
 */

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed', message: 'Utilisez GET pour cet endpoint' });

    try {
        const file = path.join(process.cwd(), 'updates', 'manifest.json');
        if (!fs.existsSync(file)) {
            return res.status(404).json({ error: 'No manifest', message: 'Aucun manifeste de mise à jour publié' });
        }
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        return res.status(200).json(manifest);
    } catch (error) {
        console.error('❌ Erreur manifest:', error);
        return res.status(500).json({ error: 'Internal error', message: 'Impossible de lire le manifeste' });
    }
}
