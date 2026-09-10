// /api/download : redirection vers l'installeur de la version annoncée par latest.js.
const path = require('path');
const { pathToFileURL } = require('url');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}
function fakeRes() {
    const r = { headers: {}, code: 0, body: null, ended: false };
    r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.end = () => { r.ended = true; return r; };
    return r;
}

(async function () {
    const mod = await import(pathToFileURL(path.join(__dirname, '..', 'backend-trial', 'lib', 'download.js')).href);
    const latest = await import(pathToFileURL(path.join(__dirname, '..', 'backend-trial', 'api', 'version', 'latest.js')).href);
    const v = latest.LATEST.version;
    check('latest.js exporte LATEST.version au format x.y.z', /^\d+\.\d+\.\d+$/.test(v), true);
    check('latest.js : downloadUrl = page du site (plus GitHub)', latest.LATEST.downloadUrl, 'https://logotyps.fr/update');

    // Comme en prod : la requête passe par le handler de latest.js avec ?download=1 (route vercel.json).
    const call = async (query, ua, method = 'GET') => { const r = fakeRes(); await latest.default({ method, query: Object.assign({ download: '1' }, query), headers: { 'user-agent': ua } }, r); return r; };

    console.log('\n--- redirections ---');
    let r = await call({ platform: 'mac' }, '');
    check('mac → 302', r.code, 302);
    check('mac → .pkg de la version courante', r.headers.location, 'https://github.com/pupilleagence-source/logo-declinaisons-releases/releases/download/v' + v + '/LogoDeclinaisons-' + v + '-mac.pkg');
    r = await call({ platform: 'windows' }, '');
    check('windows → .exe', r.headers.location.endsWith('/LogoDeclinaisons-' + v + '-windows.exe'), true);
    r = await call({ platform: 'WIN' }, '');
    check('alias WIN accepté', r.headers.location.endsWith('-windows.exe'), true);
    check('jamais mis en cache', /no-store/.test(r.headers['cache-control']), true);

    console.log('\n--- détection par User-Agent ---');
    r = await call({}, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15');
    check('UA Mac → .pkg', r.headers.location.endsWith('-mac.pkg'), true);
    r = await call({}, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128');
    check('UA Windows → .exe', r.headers.location.endsWith('-windows.exe'), true);
    r = await call({}, 'curl/8.0');
    check('UA inconnu → 400 explicite', [r.code, /platform=mac/.test(r.body.message)], [400, true]);
    r = await call({ platform: 'linux' }, 'Mozilla/5.0 (Macintosh)');
    check('plateforme explicite inconnue → 400 (pas de repli UA)', r.code, 400);

    console.log('\n--- info=1 ---');
    r = await call({ platform: 'mac', info: '1' }, '');
    check('200 JSON', [r.code, r.body.platform, r.body.version, r.body.fileName], [200, 'mac', v, 'LogoDeclinaisons-' + v + '-mac.pkg']);

    console.log('\n--- méthodes ---');
    r = await call({ platform: 'mac' }, '', 'POST');
    check('POST → 405', r.code, 405);
    r = await call({}, '', 'OPTIONS');
    check('OPTIONS → 200', r.code, 200);
    const plain = fakeRes(); await latest.default({ method: 'GET', query: {}, headers: {} }, plain);
    check('sans ?download=1, latest.js répond le JSON de version', [plain.code, plain.body.version], [200, v]);
    check('le JSON de version ne contient pas d en-tête Location', plain.headers.location, undefined);

    console.log('\n--- helpers ---');
    check('detectPlatform Darwin', mod.detectPlatform('Darwin'), 'mac');
    check('handleDownload direct', (() => { const r = fakeRes(); mod.handleDownload({ method: 'GET', query: { platform: 'mac' }, headers: {} }, r, { version: '9.9.9' }); return r.headers.location; })(), 'https://github.com/pupilleagence-source/logo-declinaisons-releases/releases/download/v9.9.9/LogoDeclinaisons-9.9.9-mac.pkg');
    check('normalizePlatform macos', mod.normalizePlatform('macOS'), 'mac');
    check('normalizePlatform vide', mod.normalizePlatform(''), null);

    console.log(`\n${pass} OK, ${fail} echec(s)\n`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
