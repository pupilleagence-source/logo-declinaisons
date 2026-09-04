// Extrait les helpers reels de js/main.js et les exerce sur une arborescence temporaire.
const fs = require('fs');
const path = require('path');
const os = require('os');

const src = fs.readFileSync('js/main.js', 'utf8');

function extract(name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('introuvable: ' + name);
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) break; }
    }
    return src.slice(start, i + 1);
}

const names = ['sanitizeFolderName', 'folderHasPreviousExport', 'emptyFolderRecursive', 'nextAvailableFolder'];
const markersSrc = src.match(/const EXPORT_MARKERS = \[[\s\S]*?\];/)[0];
const code = markersSrc + '\n' + names.map(extract).join('\n') + '\nmodule.exports = {' + names.join(',') + '};';
const mod = { exports: {} };
new Function('require', 'module', 'console', code)(require, mod, console);
const H = mod.exports;

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}

console.log('\n--- sanitizeFolderName (protection contre l\'echappement de chemin) ---');
check('nom normal',              H.sanitizeFolderName('Logopack'), 'Logopack');
check('slash',                   H.sanitizeFolderName('a/b'), 'a-b');
check('antislash',               H.sanitizeFolderName('a\\b'), 'a-b');
check('remontee ../..',          H.sanitizeFolderName('../../etc'), '-..-etc');
check('caracteres Windows',      H.sanitizeFolderName('a:b*c?d"e<f>g|h'), 'a-b-c-d-e-f-g-h');
check('vide -> defaut',          H.sanitizeFolderName(''), 'Logopack');
check('espaces seuls -> defaut', H.sanitizeFolderName('   '), 'Logopack');
check('points en tete',          H.sanitizeFolderName('...cache'), 'cache');
check('null -> defaut',          H.sanitizeFolderName(null), 'Logopack');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logopack-test-'));

console.log('\n--- folderHasPreviousExport ---');
const vide = path.join(root, 'vide');
fs.mkdirSync(vide);
check('dossier vide', H.folderHasPreviousExport(vide), false);

const avecAutre = path.join(root, 'autre');
fs.mkdirSync(avecAutre);
fs.writeFileSync(path.join(avecAutre, 'photo.jpg'), 'x');
check('dossier sans marqueur', H.folderHasPreviousExport(avecAutre), false);

const avecExport = path.join(root, 'export');
fs.mkdirSync(avecExport);
fs.mkdirSync(path.join(avecExport, 'horizontal'));
check('dossier avec horizontal/', H.folderHasPreviousExport(avecExport), true);

const avecAi = path.join(root, 'exportAi');
fs.mkdirSync(avecAi);
fs.writeFileSync(path.join(avecAi, 'logo-export-variation.ai'), 'x');
check('dossier avec le .ai', H.folderHasPreviousExport(avecAi), true);
check('dossier inexistant', H.folderHasPreviousExport(path.join(root, 'nope')), false);

console.log('\n--- nextAvailableFolder ---');
fs.mkdirSync(path.join(root, 'Logopack'));
check('premier libre = -2', path.basename(H.nextAvailableFolder(root, 'Logopack')), 'Logopack-2');
fs.mkdirSync(path.join(root, 'Logopack-2'));
check('puis -3', path.basename(H.nextAvailableFolder(root, 'Logopack')), 'Logopack-3');

console.log('\n--- emptyFolderRecursive (DESTRUCTIF) ---');
const cible = path.join(root, 'aVider');
fs.mkdirSync(cible);
fs.writeFileSync(path.join(cible, 'fichier.txt'), 'x');
fs.mkdirSync(path.join(cible, 'sous'));
fs.mkdirSync(path.join(cible, 'sous', 'profond'));
fs.writeFileSync(path.join(cible, 'sous', 'profond', 'a.png'), 'x');
fs.writeFileSync(path.join(cible, 'sous', 'b.png'), 'x');
const temoin = path.join(root, 'voisin.txt');
fs.writeFileSync(temoin, 'ne doit pas bouger');

H.emptyFolderRecursive(cible);

check('le dossier cible existe toujours', fs.existsSync(cible), true);
check('son contenu est vide', fs.readdirSync(cible), []);
check('le voisin est intact', fs.existsSync(temoin), true);
check('les freres sont intacts', fs.existsSync(avecExport), true);

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
