// Les fonctions pures de scripts/release.js : rendu de latest.js et calcul des bumps.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { renderLatest, computeBumps } = require('../scripts/release.js');

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
fixture('installer.iss', '#define MyAppVersion "1.2.0"');
fixture('installers/mac/build-pkg.sh', 'VERSION="${VERSION:-1.2.0}"');
fixture('.github/workflows/build-installers.yml', "        default: '1.2.0'");

const bumps = computeBumps(root, '1.2.0', '1.3.0');
check('6 fichiers calcules (latest.js est traite a part)', bumps.length, 6);
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
console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
