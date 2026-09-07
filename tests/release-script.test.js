// Les fonctions pures de scripts/release.js : rendu de latest.js et calcul des bumps.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { renderLatest, computeBumps, buildManifest, distributionBytes, assetsFingerprint, signManifest } = require('../scripts/release.js');
const AutoUpdater = require('../js/auto-updater.js');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}
function parses(src) {
    try { execSync('node --input-type=module --check', { input: src, stdio: ['pipe', 'ignore', 'ignore'] }); return true; } catch (e) { return false; }
}

console.log('\n--- renderLatest sur le VRAI latest.js du repo ---');
const real = fs.readFileSync('backend-trial/api/version/latest.js', 'utf8');
let out = renderLatest(real, '9.9.9', '2030-01-01', ['Première ligne', "Ligne avec l'apostrophe"]);
check('version remplacee',        /version:\s*'9\.9\.9'/.test(out), true);
check('date remplacee',           /releaseDate:\s*'2030-01-01'/.test(out), true);
check('changelog remplace',       out.includes('"Première ligne"') && out.includes(`"Ligne avec l'apostrophe"`), true);
check('ancien changelog disparu', out.includes('Repli horizontal'), false);
check('CRLF conserve',            out.includes('\r\n') === real.includes('\r\n'), true);
check('le module parse toujours', parses(out), true);
check('la JSDoc au-dessus (qui contient "version") est intacte', out.includes(' *   version: string,'), true);

console.log('\n--- Le piege du crochet : une ligne "[BETA] …" ne casse PAS la release SUIVANTE ---');
const r1 = renderLatest(real, '1.3.0', '2026-09-06', ['[BETA] Présentation InDesign', 'Autre ligne']);
check('release 1 parse', parses(r1), true);
const r2 = renderLatest(r1, '1.4.0', '2026-10-01', ['Ligne suivante']);
check('release 2 parse', parses(r2), true);
check('release 2 a bien remplace tout le tableau', r2.includes('[BETA]'), false);
check('release 2 contient la nouvelle ligne', r2.includes('"Ligne suivante"'), true);

console.log('\n--- Le piege du dollar : "$\'" et "$&" ne sont pas interpretes ---');
const r3 = renderLatest(real, '1.3.0', '2026-09-06', ["Tarif 5$' au lieu de 10$", 'Prix en $$ et $& ok']);
check('parse', parses(r3), true);
check('$\' present tel quel',   r3.includes(`"Tarif 5$' au lieu de 10$"`), true);
check('$$ present tel quel',    r3.includes('"Prix en $$ et $& ok"'), true);

console.log('\n--- renderLatest refuse un fichier sans les 3 champs ---');
let threw = false; try { renderLatest('export default 1;', '1.0.0', '2026-01-01', ['x']); } catch (e) { threw = /0\/3/.test(e.message); }
check('erreur explicite', threw, true);

console.log('\n--- computeBumps : tout ou rien, sans rien ecrire ---');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
function fixture(rel, content) { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
fixture('CSXS/manifest.xml', '<X ExtensionBundleVersion="1.2.0"><E Version="1.2.0" /></X>');
fixture('package.json', '{"version": "1.2.0","cep":{"version": "1.2.0"},"packager":{"version": "1.2.0"}}');
fixture('js/updater.js', "const U = { CURRENT_VERSION: '1.2.0' };");
fixture('jsx/hostscript.jsx', "var HOSTSCRIPT_VERSION = '1.2.0';");
fixture('installer.iss', '#define MyAppVersion "1.2.0"');
fixture('installers/mac/build-pkg.sh', 'VERSION="${VERSION:-1.2.0}"');
fixture('.github/workflows/build-installers.yml', "        default: '1.2.0'");

const bumps = computeBumps(root, '1.2.0', '1.3.0');
check('7 fichiers calcules (latest.js est traite a part)', bumps.length, 7);
check('hostscript.jsx bumpe', bumps.find(b => b.rel === 'jsx/hostscript.jsx').content, "var HOSTSCRIPT_VERSION = '1.3.0';");
check('aucun 1.2.0 residuel', bumps.every(b => !b.content.includes('1.2.0')), true);
check('package.json : les 3 occurrences', (bumps.find(b => b.rel === 'package.json').content.match(/1\.3\.0/g) || []).length, 3);
check('rien n a ete ecrit sur le disque', fs.readFileSync(path.join(root, 'installer.iss'), 'utf8'), '#define MyAppVersion "1.2.0"');

// Un fichier desaligne (hotfix manuel) : erreur nommant le fichier, et rien d'ecrit.
fixture('js/updater.js', "const U = { CURRENT_VERSION: '1.2.1' };");
let err = null; try { computeBumps(root, '1.2.0', '1.3.0'); } catch (e) { err = e.message; }
check('erreur nomme le fichier desaligne', err && err.startsWith('js/updater.js'), true);
check('erreur dit quoi faire', err && /aligner a la main/.test(err), true);
check('manifest.xml intact malgre l echec', fs.readFileSync(path.join(root, 'CSXS/manifest.xml'), 'utf8').includes('1.2.0'), true);

fs.rmSync(root, { recursive: true, force: true });

console.log('\n--- distributionBytes : texte normalise en LF, binaire intact ---');
check('CRLF -> LF pour .js', distributionBytes('js/a.js', Buffer.from('a\r\nb\r\n')).toString(), 'a\nb\n');
check('LF inchange', distributionBytes('index.html', Buffer.from('a\nb')).toString(), 'a\nb');
check('svg normalise aussi', distributionBytes('media/logo.svg', Buffer.from('<svg>\r\n')).toString(), '<svg>\n');
const bin = Buffer.from([0x0d, 0x0a, 0x00, 0xff]);
check('.png intact', distributionBytes('media/x.png', bin).equals(bin), true);

console.log('\n--- buildManifest : contenu, hachage, hotUpdateFrom ---');
const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'release-manifest-'));
function put(rel, content) { const p = path.join(ext, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
put('index.html', '<html>\r\n');
put('js/main.js', 'main\r\n'); put('js/main.js.backup', 'IGNORE'); put('js/.write-probe-1', 'IGNORE');
put('jsx/hostscript.jsx', 'jsx'); put('CSXS/manifest.xml', '<x/>'); put('css/styles.css', 'css'); put('lib/a.js', 'lib'); put('media/logo.svg', '<svg/>');
put('templates/template-1.idml', 'IDML'); put('templates/mockups/a.psd', 'PSD');
put('scripts/release.js', 'NOT SHIPPED'); put('tests/x.test.js', 'NOT SHIPPED'); put('CLAUDE.md', 'NOT SHIPPED');
const fp1 = assetsFingerprint(ext, ['templates/template-1.idml', 'templates/mockups']);
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');

let b = buildManifest(ext, { version: '1.4.0', date: '2026-09-07', changelog: ['a'], previous: null, requireInstaller: false, fingerprint: fp1 });
const paths = b.manifest.files.map(f => f.path);
check('fichiers du panneau uniquement', paths, ['CSXS/manifest.xml', 'css/styles.css', 'index.html', 'js/main.js', 'jsx/hostscript.jsx', 'lib/a.js', 'media/logo.svg']);
check('.backup et fichiers caches exclus', paths.some(p => /backup|write-probe/.test(p)), false);
check('scripts/ tests/ CLAUDE.md exclus', paths.some(p => /scripts|tests|CLAUDE/.test(p)), false);
check('sha256 calcule sur les octets LF', b.manifest.files.find(f => f.path === 'index.html').sha256, sha('<html>\n'));
check('size = octets LF', b.manifest.files.find(f => f.path === 'js/main.js').size, 5);
check('payload = memes octets que le hash', sha(b.payload.find(p => p.rel === 'index.html').bytes), b.manifest.files.find(f => f.path === 'index.html').sha256);
check('premier manifeste : hotUpdateFrom = version', b.manifest.hotUpdateFrom, '1.4.0');
check('restartRequired', b.manifest.restartRequired, true);
check('tous les chemins acceptes par le client', b.manifest.files.every(f => AutoUpdater.isAllowedPath(f.path)), true);

const prev = b.manifest;
b = buildManifest(ext, { version: '1.4.1', date: '2026-09-08', changelog: ['b'], previous: prev, requireInstaller: false, fingerprint: fp1 });
check('assets inchanges : hotUpdateFrom conserve (1.4.0)', b.manifest.hotUpdateFrom, '1.4.0');
b = buildManifest(ext, { version: '1.4.2', date: '2026-09-09', changelog: ['c'], previous: prev, requireInstaller: true, fingerprint: fp1 });
check('--require-installer : hotUpdateFrom = version', b.manifest.hotUpdateFrom, '1.4.2');
put('templates/mockups/a.psd', 'PSD v2');
const fp2 = assetsFingerprint(ext, ['templates/template-1.idml', 'templates/mockups']);
check('empreinte change quand un PSD change', fp1 === fp2, false);
b = buildManifest(ext, { version: '1.5.0', date: '2026-10-01', changelog: ['d'], previous: prev, requireInstaller: false, fingerprint: fp2 });
check('assets changes : hotUpdateFrom = version', b.manifest.hotUpdateFrom, '1.5.0');
check('empreinte stockee dans le manifeste', b.manifest.assetsFingerprint, fp2);

console.log('\n--- signManifest avec une paire jetable, verifie par le client ---');
const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const signed = signManifest(b.manifest, kp.privateKey.export({ type: 'pkcs8', format: 'pem' }));
check('signature presente', typeof signed.signature === 'string' && signed.signature.length > 100, true);
check('verifiee par AutoUpdater', AutoUpdater.verifyManifestSignature(signed, kp.publicKey.export({ type: 'spki', format: 'pem' })), true);
check('JSON aller-retour toujours valide (ordre des cles indifferent)', AutoUpdater.verifyManifestSignature(JSON.parse(JSON.stringify(signed)), kp.publicKey.export({ type: 'spki', format: 'pem' })), true);
fs.rmSync(ext, { recursive: true, force: true });

console.log('\n--- la cle publique embarquee correspond a la cle privee locale (si presente) ---');
const keyPath = path.join(__dirname, '..', 'apple-cert', 'update-manifest.key');
if (fs.existsSync(keyPath)) {
    const s2 = signManifest({ version: '0.0.0', files: [] }, fs.readFileSync(keyPath, 'utf8'));
    check('apple-cert/update-manifest.key <-> AutoUpdater.PUBLIC_KEY_PEM', AutoUpdater.verifyManifestSignature(s2), true);
} else {
    console.log('  (cle privee absente sur cette machine : test saute)');
}
console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
