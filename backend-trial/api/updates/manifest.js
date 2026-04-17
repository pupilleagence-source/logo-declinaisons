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
        const base = 'https://logotyps.vercel.app/api/updates/files?file=';
        const manifest = {
            version: '1.1.0',
            releaseDate: '2026-04-17',
            changelog: [
                'Support multilangue (FR / EN / ES / IT)',
                'Presentation InDesign avec mockups Photoshop',
                'Licence stable (HWID hardware, persistance disque)',
                'Nouveau design DA Logotyps'
            ],
            files: [
                { path: 'index.html', url: base + 'index.html', checksum: 'e28ed216a144d16cedbdbb939d2b474eedf1b52f9690ef673d2904f4300f3f60' },
                { path: 'css/styles.css', url: base + 'css/styles.css', checksum: 'ad23d6155bf3fd13ce138b1734f1e8c01ce1de2f23dab884d2c76538362ec214' },
                { path: 'js/main.js', url: base + 'js/main.js', checksum: 'bfa0cd8ef1606d7a60dcc3de1050eede118a74f9a8c0b9c7a427f98eeb26ad5f' },
                { path: 'js/updater.js', url: base + 'js/updater.js', checksum: '8c2747b12856950223ff4ebc68f8be3c45e865ea7e3104cb1608561e27ce9b3d' },
                { path: 'js/trial.js', url: base + 'js/trial.js', checksum: 'ea244f932d97e59d6a1108227ee2f67bf2ac3edeecdfc470494399aa0fdd7b48' },
                { path: 'js/hwid.js', url: base + 'js/hwid.js', checksum: '2e34cbf29d18d285fbc4a50e698aa591bf14bc1e5cc590c99a5828d2f57b34af' },
                { path: 'js/i18n.js', url: base + 'js/i18n.js', checksum: 'a92a5002db1ef4c23fd018e82fdf7d2b05de6b1954105b55650d8666216c60f4' },
                { path: 'js/idml-generator.js', url: base + 'js/idml-generator.js', checksum: 'ca8152f9b7537ca752a48eab0d6f76bd6a88d5b75512d76aea546699c0fccd11' },
                { path: 'js/auto-updater.js', url: base + 'js/auto-updater.js', checksum: '7a71ca913c523d7a85282146fb39a3f38faa6fe67050bf796c58e2041fd3b69c' },
                { path: 'js/debug-mode-enabler.js', url: base + 'js/debug-mode-enabler.js', checksum: '53316b0d310a7996200c0515c7ed778e4d905a0abfbc0ab03503005d21f8c42f' },
                { path: 'jsx/hostscript.jsx', url: base + 'jsx/hostscript.jsx', checksum: '7beac4145fc1a9b12ff5bf0b4a7aababd73a9da0c48108209931323bd8e53ac3' },
                { path: 'CSXS/manifest.xml', url: base + 'CSXS/manifest.xml', checksum: '50500e19ef12981ca07c10259ae7381bd8fad97cb0f2068ed2df9ff453060d7f' }
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
