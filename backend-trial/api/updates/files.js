/**
 * API Endpoint: /api/updates/files
 * Sert les fichiers de mise à jour
 *
 * Query params:
 *   - file: nom du fichier à télécharger (ex: main.js, index.html, hostscript.jsx)
 *
 * GET /api/updates/files?file=main.js
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
        const { file } = req.query;

        if (!file) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'Le paramètre "file" est requis'
            });
        }

        // Sécurité : empêcher les path traversal attacks
        const safePath = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, '');

        // Dossier contenant les fichiers de distribution
        // NOTE: Vous devrez créer ce dossier et y placer vos fichiers
        const distributionDir = path.join(process.cwd(), 'distribution');
        const filePath = path.join(distributionDir, safePath);

        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: 'File not found',
                message: `Le fichier ${safePath} n'existe pas`
            });
        }

        // Vérifier que le fichier est bien dans le dossier de distribution
        // (protection contre path traversal)
        if (!filePath.startsWith(distributionDir)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Accès interdit'
            });
        }

        // Lire le fichier
        const fileContent = fs.readFileSync(filePath);

        // Calculer le checksum pour vérification
        const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');

        // Déterminer le Content-Type selon l'extension
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.js': 'application/javascript',
            '.html': 'text/html',
            '.css': 'text/css',
            '.jsx': 'application/javascript',
            '.json': 'application/json'
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';

        // Envoyer le fichier
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-File-Checksum', checksum);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(fileContent);

    } catch (error) {
        console.error('Erreur /api/updates/files:', error);

        return res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
}
