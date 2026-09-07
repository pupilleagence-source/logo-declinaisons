// Mise a jour a chaud (js/auto-updater.js) : signature, chemins, application avec un
// telechargeur injecte. Tout tourne dans un dossier temporaire, jamais dans le repo.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const AutoUpdater = require('../js/auto-updater.js');
const applyPendingUpdates = require('../js/pending-updates.js');
const { canonicalManifest, signManifest } = require('../scripts/release.js');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUB = publicKey.export({ type: 'spki', format: 'pem' });
const PRIV = privateKey.export({ type: 'pkcs8', format: 'pem' });

(async function () {
    console.log('\n--- canonicalManifest : identique cote release et cote client ---');
    const m = { version: '1.4.0', files: [{ sha256: 'a', path: 'js/x.js' }], b: { z: 1, a: [3, { y: 1, x: 2 }] }, signature: 'IGNORE' };
    check('client == release', AutoUpdater.canonicalManifest(m), canonicalManifest(m));
    check('cles triees, signature exclue', AutoUpdater.canonicalManifest(m), '{"b":{"a":[3,{"x":2,"y":1}],"z":1},"files":[{"path":"js/x.js","sha256":"a"}],"version":"1.4.0"}');

    console.log('\n--- signature ---');
    const signed = signManifest({ version: '1.4.0', files: [] }, PRIV);
    check('verifie avec la bonne cle', AutoUpdater.verifyManifestSignature(signed, PUB), true);
    check('refusee avec la cle embarquee (autre paire)', AutoUpdater.verifyManifestSignature(signed), false);
    check('refusee si un champ change', AutoUpdater.verifyManifestSignature(Object.assign({}, signed, { version: '9.9.9' }), PUB), false);
    check('refusee sans signature', AutoUpdater.verifyManifestSignature({ version: '1.4.0' }, PUB), false);
    check('refusee si signature vide', AutoUpdater.verifyManifestSignature(Object.assign({}, signed, { signature: '' }), PUB), false);
    check('refusee si manifest null', AutoUpdater.verifyManifestSignature(null, PUB), false);

    console.log('\n--- isAllowedPath ---');
    for (const [p, exp] of [['js/main.js', true], ['index.html', true], ['CSXS/manifest.xml', true], ['jsx/hostscript.jsx', true], ['lib/jszip.min.js', true],
                            ['../x.js', false], ['js/../../x', false], ['/etc/passwd', false], ['C:/x', false], ['templates/a.idml', false],
                            ['index.html.bak', false], ['', false], [null, false], ['js\\main.js', true], ['scripts/release.js', false]]) {
        check('isAllowedPath(' + JSON.stringify(p) + ')', AutoUpdater.isAllowedPath(p), exp);
    }
    console.log('\n--- validateFiles ---');
    const ok1 = { path: 'js/a.js', sha256: 'a'.repeat(64), size: 1 };
    check('liste valide', AutoUpdater.validateFiles([ok1]), null);
    check('liste vide refusee', typeof AutoUpdater.validateFiles([]), 'string');
    check('chemin en double refuse', /double/.test(AutoUpdater.validateFiles([ok1, { path: 'js\\a.js', sha256: 'b'.repeat(64), size: 2 }])), true);
    check('taille manquante refusee', typeof AutoUpdater.validateFiles([{ path: 'js/a.js', sha256: 'a'.repeat(64) }]), 'string');
    check('taille negative refusee', typeof AutoUpdater.validateFiles([{ path: 'js/a.js', sha256: 'a'.repeat(64), size: -1 }]), 'string');
    check('taille aberrante refusee', typeof AutoUpdater.validateFiles([{ path: 'js/a.js', sha256: 'a'.repeat(64), size: 1e12 }]), 'string');
    check('collision js/x/y.js vs js/x__y.js acceptee comme deux entrees distinctes', AutoUpdater.validateFiles([{ path: 'js/x/y.js', sha256: 'a'.repeat(64), size: 1 }, { path: 'js/x__y.js', sha256: 'b'.repeat(64), size: 1 }]), null);

    console.log('\n--- applyUpdate dans un faux dossier d extension ---');
    const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-update-'));
    const w = (rel, s) => { const p = path.join(ext, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const r = (rel) => fs.readFileSync(path.join(ext, rel), 'utf8');
    w('index.html', 'OLD HTML'); w('js/main.js', 'OLD MAIN'); w('jsx/hostscript.jsx', 'OLD JSX'); w('templates/t.idml', 'TEMPLATE');
    w('js/same.js', 'SAME');

    const server = { 'index.html': 'NEW HTML', 'js/main.js': 'NEW MAIN', 'jsx/hostscript.jsx': 'NEW JSX', 'js/new-file.js': 'BRAND NEW', 'js/same.js': 'SAME' };
    const fetched = [];
    const fetch = async (url, dest) => {
        const rel = decodeURIComponent(url.split('file=')[1]);
        fetched.push(rel);
        if (!(rel in server)) throw new Error('HTTP 404 pour ' + rel);
        fs.writeFileSync(dest, server[rel]);
    };
    const manifestFor = (files) => signManifest({ version: '1.4.0', files }, PRIV);
    const good = manifestFor(Object.keys(server).map(p => ({ path: p, sha256: sha(server[p]), size: server[p].length })));

    let res = await AutoUpdater.applyUpdate(good, { extensionPath: ext, filesBaseUrl: 'https://x/api/updates/files?file=', fetch, publicKeyPem: PUB });
    check('succes', res.success, true);
    check('needsRestart', res.needsRestart, true);
    check('index.html remplace', r('index.html'), 'NEW HTML');
    check('js/main.js remplace', r('js/main.js'), 'NEW MAIN');
    check('jsx/hostscript.jsx remplace', r('jsx/hostscript.jsx'), 'NEW JSX');
    check('nouveau fichier cree', r('js/new-file.js'), 'BRAND NEW');
    check('templates/ intact', r('templates/t.idml'), 'TEMPLATE');
    check('fichier deja a jour NON telecharge', fetched.includes('js/same.js'), false);
    check('4 telechargements', fetched.length, 4);
    check('pas de .backup residuel', fs.readdirSync(path.join(ext, 'js')).filter(n => n.endsWith('.backup')).length, 0);
    check('pas de .temp_update residuel', fs.existsSync(path.join(ext, '.temp_update')), false);
    check('filesUpdated liste les 4 fichiers changes', res.filesUpdated.sort(), ['index.html', 'js/main.js', 'js/new-file.js', 'jsx/hostscript.jsx']);

    console.log('\n--- empreinte incorrecte : rien n est touche ---');
    w('index.html', 'V1'); w('js/main.js', 'V1');
    server['index.html'] = 'V2'; server['js/main.js'] = 'V2 CORRUPT';
    const badSum = manifestFor([{ path: 'index.html', sha256: sha('V2'), size: 2 }, { path: 'js/main.js', sha256: sha('V2'), size: 2 }]);
    res = await AutoUpdater.applyUpdate(badSum, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('echec signale', res.success, false);
    check('erreur nomme le fichier', /js\/main\.js/.test(res.error), true);
    check('index.html PAS remplace (tout ou rien)', r('index.html'), 'V1');
    check('js/main.js intact', r('js/main.js'), 'V1');
    check('.temp_update nettoye', fs.existsSync(path.join(ext, '.temp_update')), false);

    console.log('\n--- telechargement en echec : rien n est touche ---');
    const missing = manifestFor([{ path: 'index.html', sha256: sha('V2'), size: 2 }, { path: 'js/absent.js', sha256: sha('x'), size: 1 }]);
    res = await AutoUpdater.applyUpdate(missing, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('echec signale', res.success, false);
    check('index.html PAS remplace', r('index.html'), 'V1');

    console.log('\n--- taille servie != taille signee : rien n est touche ---');
    server['index.html'] = 'V2 PLUS LONG';
    const badSize = manifestFor([{ path: 'index.html', sha256: sha('V2 PLUS LONG'), size: 2 }]);
    res = await AutoUpdater.applyUpdate(badSize, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('echec signale', res.success, false);
    check('message taille + fichier', /taille/.test(res.error) && /index\.html/.test(res.error), true);
    check('index.html PAS remplace', r('index.html'), 'V1');
    server['index.html'] = 'V2';

    console.log('\n--- deux entrees aux noms temporaires jadis en collision ---');
    server['js/x/y.js'] = 'DEEP'; server['js/x__y.js'] = 'FLAT';
    const twin = manifestFor([{ path: 'js/x/y.js', sha256: sha('DEEP'), size: 4 }, { path: 'js/x__y.js', sha256: sha('FLAT'), size: 4 }]);
    res = await AutoUpdater.applyUpdate(twin, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('succes', res.success, true);
    check('js/x/y.js a SON contenu', r('js/x/y.js'), 'DEEP');
    check('js/x__y.js a SON contenu', r('js/x__y.js'), 'FLAT');

    console.log('\n--- echec en phase 2 (remplacement) : rollback complet ---');
    w('index.html', 'V1'); w('js/main.js', 'V1'); w('css/styles.css', 'V1');
    try { fs.unlinkSync(path.join(ext, 'js/brand-new.js')); } catch (e) {}
    server['index.html'] = 'V2'; server['js/main.js'] = 'V2'; server['css/styles.css'] = 'V2'; server['js/brand-new.js'] = 'NEW';
    const origReplace = AutoUpdater.replaceFile;
    let calls = 0;
    AutoUpdater.replaceFile = function (src, dest) {
        calls++;
        if (calls === 2) { fs.copyFileSync(src, dest + '.pending'); return 'RESTART_REQUIRED'; } // verrou Windows simule
        if (calls === 4) throw new Error('boom');
        return origReplace.call(this, src, dest);
    };
    const four = manifestFor(['css/styles.css', 'index.html', 'js/brand-new.js', 'js/main.js'].map(p => ({ path: p, sha256: sha(server[p]), size: server[p].length })));
    res = await AutoUpdater.applyUpdate(four, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    AutoUpdater.replaceFile = origReplace;
    check('echec signale', res.success, false);
    check('erreur = boom', /boom/.test(res.error), true);
    check('filesUpdated vide', res.filesUpdated, []);
    check('needsRestart false', res.needsRestart, false);
    check('css/styles.css restaure', r('css/styles.css'), 'V1');
    check('index.html restaure', r('index.html'), 'V1');
    check('js/main.js restaure', r('js/main.js'), 'V1');
    check('fichier nouvellement cree supprime', fs.existsSync(path.join(ext, 'js/brand-new.js')), false);
    check('aucun .pending residuel', fs.existsSync(path.join(ext, 'index.html.pending')) || fs.readdirSync(path.join(ext, 'js')).some(n => n.endsWith('.pending')), false);
    check('aucun .backup residuel', [ext, path.join(ext, 'js'), path.join(ext, 'css')].some(d => fs.readdirSync(d).some(n => n.endsWith('.backup'))), false);
    check('.temp_update nettoye', fs.existsSync(path.join(ext, '.temp_update')), false);

    console.log('\n--- fichier verrouille sans autre echec : .pending depose, succes ---');
    calls = 0;
    AutoUpdater.replaceFile = function (src, dest) { calls++; if (calls === 1) { fs.copyFileSync(src, dest + '.pending'); return 'RESTART_REQUIRED'; } return origReplace.call(this, src, dest); };
    res = await AutoUpdater.applyUpdate(four, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    AutoUpdater.replaceFile = origReplace;
    check('succes', res.success, true);
    check('needsRestart', res.needsRestart, true);
    check('css/styles.css.pending present (verrouille)', fs.existsSync(path.join(ext, 'css/styles.css.pending')), true);
    check('css/styles.css encore V1 jusqu au prochain lancement', r('css/styles.css'), 'V1');
    check('les autres sont remplaces', r('index.html') + r('js/main.js') + r('js/brand-new.js'), 'V2V2NEW');
    check('js/pending-updates.js applique le .pending', applyPendingUpdates(ext), 1);
    check('css/styles.css a jour apres application', r('css/styles.css'), 'V2');
    delete server['js/brand-new.js']; delete server['js/x/y.js']; delete server['js/x__y.js']; delete server['css/styles.css'];
    // Etat de depart attendu par la section suivante (qui verifie que RIEN ne change).
    w('index.html', 'V1'); w('js/main.js', 'V1'); server['index.html'] = 'V2'; server['js/main.js'] = 'V2';

    console.log('\n--- manifeste refuse ---');
    const outside = manifestFor([{ path: '../evil.js', sha256: sha('x'), size: 1 }]);
    res = await AutoUpdater.applyUpdate(outside, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('chemin hors extension refuse', res.success, false);
    check('message explicite', /refus/.test(res.error), true);
    const tpl = manifestFor([{ path: 'templates/t.idml', sha256: sha('x'), size: 1 }]);
    res = await AutoUpdater.applyUpdate(tpl, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('templates/ refuse (ressort de l installeur)', res.success, false);
    const unsigned = { version: '1.4.0', files: [{ path: 'index.html', sha256: sha('V2'), size: 2 }] };
    res = await AutoUpdater.applyUpdate(unsigned, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('non signe refuse', res.success, false);
    check('message signature', /signature/.test(res.error), true);
    check('aucun telechargement tente pour un manifeste refuse', fetched.filter(f => f === '../evil.js').length, 0);
    const badHash = manifestFor([{ path: 'index.html', sha256: 'zz', size: 2 }]);
    res = await AutoUpdater.applyUpdate(badHash, { extensionPath: ext, filesBaseUrl: 'https://x/?file=', fetch, publicKeyPem: PUB });
    check('sha256 mal forme refuse', res.success, false);
    check('index.html toujours V1', r('index.html'), 'V1');

    console.log('\n--- js/pending-updates.js (celui qui tourne en production) / isExtensionWritable ---');
    w('js/locked.js', 'OLD'); w('js/locked.js.pending', 'NEW'); w('index.html.pending', 'NEW HTML');
    w('templates/x.psd.pending', 'MUST STAY');
    const applied = applyPendingUpdates(ext);
    check('2 fichiers appliques', applied, 2);
    check('aucun .pending -> 0', applyPendingUpdates(ext), 0);
    check('racine nulle -> 0 sans exception', applyPendingUpdates(null), 0);
    check('js/locked.js mis a jour', r('js/locked.js'), 'NEW');
    check('index.html mis a jour', r('index.html'), 'NEW HTML');
    check('.pending consomme', fs.existsSync(path.join(ext, 'js/locked.js.pending')), false);
    check('templates/ jamais parcouru', fs.existsSync(path.join(ext, 'templates/x.psd.pending')), true);
    check('dossier temporaire modifiable', AutoUpdater.isExtensionWritable(ext), true);
    check('dossier inexistant non modifiable', AutoUpdater.isExtensionWritable(path.join(ext, 'nope', 'nope')), false);
    check('pas de sonde residuelle', fs.readdirSync(ext).filter(n => n.startsWith('.write-probe')).length, 0);

    fs.rmSync(ext, { recursive: true, force: true });
    console.log(`\n${pass} OK, ${fail} echec(s)\n`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
