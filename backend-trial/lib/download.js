/**
 * Téléchargement de l'installeur : redirige vers le fichier de la dernière version,
 * sans jamais montrer GitHub.
 *
 * Servi par /api/download, qui est en réalité une route vers
 * /api/version/latest.js?download=1 (vercel.json) : le plan Hobby de Vercel plafonne
 * à 12 fonctions par déploiement et les 12 sont prises. Ce fichier vit donc dans
 * lib/ (pas de fonction supplémentaire) et latest.js l'appelle.
 *
 *   GET /api/download?platform=mac        -> 302 vers LogoDeclinaisons-<v>-mac.pkg
 *   GET /api/download?platform=windows    -> 302 vers LogoDeclinaisons-<v>-windows.exe
 *   GET /api/download                     -> plateforme devinée d'après le User-Agent
 *   GET /api/download?platform=mac&info=1 -> 200 JSON { version, platform, url, fileName }
 *
 * Les fichiers sont ceux publiés par le workflow GitHub dans le dépôt de releases ;
 * le nom des assets suit exactement celui du workflow.
 */

const RELEASES_REPO = 'https://github.com/pupilleagence-source/logo-declinaisons-releases';

export function assetFor(version, platform) {
    const fileName = platform === 'mac'
        ? 'LogoDeclinaisons-' + version + '-mac.pkg'
        : 'LogoDeclinaisons-' + version + '-windows.exe';
    return { fileName, url: RELEASES_REPO + '/releases/download/v' + version + '/' + fileName };
}

export function detectPlatform(userAgent) {
    const ua = String(userAgent || '');
    if (/Macintosh|Mac OS X|Darwin/i.test(ua)) return 'mac';
    if (/Windows/i.test(ua)) return 'windows';
    return null;
}

export function normalizePlatform(value) {
    const p = String(value || '').toLowerCase();
    if (p === 'mac' || p === 'macos' || p === 'osx' || p === 'darwin') return 'mac';
    if (p === 'windows' || p === 'win' || p === 'win32' || p === 'win64' || p === 'pc') return 'windows';
    return null;
}

// `latest` = l'objet LATEST de api/version/latest.js (passé en paramètre : pas d'import
// circulaire).
export function handleDownload(req, res, latest) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed', message: 'Utilisez GET pour cet endpoint' });

    const query = req.query || {};
    let platform = normalizePlatform(query.platform);
    if (!platform && !query.platform) platform = detectPlatform(req.headers && req.headers['user-agent']);
    if (!platform) {
        return res.status(400).json({
            error: 'Unknown platform',
            message: 'Précisez ?platform=mac ou ?platform=windows',
            version: latest.version
        });
    }

    const asset = assetFor(latest.version, platform);
    if (query.info) {
        return res.status(200).json({ version: latest.version, releaseDate: latest.releaseDate, platform, fileName: asset.fileName, url: asset.url });
    }
    res.setHeader('Location', asset.url);
    return res.status(302).end();
}
