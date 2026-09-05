// Verification croisee statique du panneau : coherence HTML <-> JS <-> JSX <-> i18n.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const js = Object.fromEntries(jsFiles.map(f => [f, fs.readFileSync(f, 'utf8')]));
const main = js['js/main.js'];
const jsx = fs.readFileSync('jsx/hostscript.jsx', 'utf8');
const i18n = js['js/i18n.js'];

let problems = 0, warnings = 0;
const bad = (m) => { console.log('  ECHEC | ' + m); problems++; };
const warn = (m) => { console.log('  attn  | ' + m); warnings++; };
const ok = (m) => console.log('  OK    | ' + m);

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');

// ---------------------------------------------------------------------------
console.log('\n1. IDs cherches par le JS -> presents dans index.html ?');
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const dynamicIds = new Set();
for (const src of Object.values(js)) {
    for (const m of src.matchAll(/id="([a-z0-9_-]+)"/gi)) dynamicIds.add(m[1]);           // innerHTML
    for (const m of src.matchAll(/\.id\s*=\s*'([a-z0-9_-]+)'/gi)) dynamicIds.add(m[1]);   // el.id = '...'
}
const wanted = new Map();
for (const [f, src] of Object.entries(js)) {
    for (const m of stripComments(src).matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!wanted.has(m[1])) wanted.set(m[1], new Set());
        wanted.get(m[1]).add(f);
    }
}
let missingIds = 0;
for (const [id, files] of wanted) {
    if (!htmlIds.has(id) && !dynamicIds.has(id)) {
        // identifiants construits dynamiquement (status-<type>) : verifier le prefixe
        const known = ['reset-trial-btn']; // mort, documente (CLAUDE.md §10)
        if (known.includes(id)) warn(`#${id} absent du HTML — mort et documenté (${[...files].join(', ')})`);
        else { bad(`#${id} cherché par ${[...files].join(', ')} mais absent de index.html`); missingIds++; }
    }
}
if (!missingIds) ok(`${wanted.size} IDs distincts cherchés par le JS, tous présents (ou créés dynamiquement)`);

// ---------------------------------------------------------------------------
console.log('\n2. Fonctions ExtendScript appelees depuis le JS -> definies dans hostscript.jsx ?');
const jsxFns = new Set([...jsx.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]));
const called = new Set();
for (const src of Object.values(js)) {
    const s = stripComments(src);
    for (const m of s.matchAll(/evalExtendScript\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) called.add(m[1]);
    for (const m of s.matchAll(/evalScript(?:Json)?\(\s*['"]([A-Za-z_$][\w$]*)\(/g)) called.add(m[1]);
    for (const m of s.matchAll(/evalScript(?:Json)?\(\s*["']([A-Za-z_$][\w$]*)\s*\(/g)) called.add(m[1]);
}
let missingFns = 0;
for (const fn of called) {
    if (!jsxFns.has(fn)) { bad(`ExtendScript "${fn}()" appelé depuis le JS mais introuvable dans hostscript.jsx`); missingFns++; }
}
if (!missingFns) ok(`${called.size} fonctions ExtendScript appelées : ${[...called].sort().join(', ')} — toutes définies`);

// ---------------------------------------------------------------------------
console.log('\n3. Cles i18n utilisees -> definies dans les 4 langues ?');
const dictBlocks = [...i18n.matchAll(/^\s{8}(fr|en|es|it):\s*\{([\s\S]*?)^\s{8}\}/gm)];
const dicts = {};
for (const m of dictBlocks) dicts[m[1]] = new Set([...m[2].matchAll(/^\s+([a-z_][a-z0-9_]*)\s*:/gm)].map(x => x[1]));
const langs = Object.keys(dicts);
const usedKeys = new Set([...html.matchAll(/data-i18n(?:-placeholder|-title)?="([^"]+)"/g)].map(m => m[1]));
for (const src of Object.values(js)) for (const m of stripComments(src).matchAll(/\bt\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) usedKeys.add(m[1]);
let missingKeys = 0;
for (const k of usedKeys) for (const l of langs) if (!dicts[l].has(k)) { bad(`clé i18n "${k}" absente du dictionnaire ${l}`); missingKeys++; }
if (!missingKeys) ok(`${usedKeys.size} clés utilisées, toutes présentes dans ${langs.join('/')} (${langs.map(l => dicts[l].size).join('/')} clés)`);
const ref = [...dicts.fr].sort().join();
if (langs.every(l => [...dicts[l]].sort().join() === ref)) ok('les 4 dictionnaires ont exactement les mêmes clés'); else bad('dictionnaires i18n désalignés');

// ---------------------------------------------------------------------------
console.log('\n4. hostscript.jsx entier : ES3 ? (commentaires exclus)');
const jsxCode = stripComments(jsx);
const es3Violations = [];
for (const [re, label] of [[/\b(let|const)\s+[A-Za-z_$]/g, 'let/const'], [/=>/g, 'arrow function'], [/`/g, 'template literal'],
                          [/\.forEach\(/g, '.forEach('], [/Array\.isArray/g, 'Array.isArray'], [/\bclass\s+[A-Z]/g, 'class']]) {
    const n = (jsxCode.match(re) || []).length;
    if (n) es3Violations.push(`${label} x${n}`);
}
// .map( est ambigu (objets nommes map) : ne signaler que "].map(" / ").map("
const mapCalls = (jsxCode.match(/[\])]\.map\(/g) || []).length;
if (mapCalls) es3Violations.push(`.map( sur tableau x${mapCalls}`);
if (es3Violations.length) bad('constructions non-ES3 dans hostscript.jsx : ' + es3Violations.join(', ')); else ok('aucune construction non-ES3 détectée');

// ---------------------------------------------------------------------------
console.log('\n5. main.js : fonctions definies vs referencees');
const mainCode = stripComments(main);
const defined = [...mainCode.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]);
const neverUsed = defined.filter(fn => (mainCode.match(new RegExp('\\b' + fn + '\\b', 'g')) || []).length < 2);
if (neverUsed.length) warn('définies mais jamais référencées dans main.js : ' + neverUsed.join(', ')); else ok(`${defined.length} fonctions définies, toutes référencées au moins une fois`);

// ---------------------------------------------------------------------------
console.log('\n6. appState : champs lus/ecrits -> declares ?');
const stateDecl = main.slice(main.indexOf('const appState = {'), main.indexOf('\n};', main.indexOf('const appState = {')));
const declaredTop = new Set([...stateDecl.matchAll(/^\s{0,2}([a-zA-Z_]\w*)\s*:/gm)].map(m => m[1]));
const usedTop = new Set([...mainCode.matchAll(/appState\.([a-zA-Z_]\w*)/g)].map(m => m[1]));
const undeclared = [...usedTop].filter(k => !declaredTop.has(k));
if (undeclared.length) bad('champs appState utilisés mais non déclarés : ' + undeclared.join(', ')); else ok(`${usedTop.size} champs appState utilisés, tous déclarés`);

// ---------------------------------------------------------------------------
console.log('\n7. Ordre de chargement des scripts dans index.html');
const order = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const idx = (s) => order.findIndex(o => o.includes(s));
if (idx('jszip') < idx('idml-generator')) ok('jszip chargé avant idml-generator'); else bad('jszip doit précéder idml-generator');
if (idx('i18n') < idx('main.js')) ok('i18n chargé avant main.js'); else bad('i18n doit précéder main.js');
if (idx('trial') < idx('main.js') && idx('hwid') < idx('trial')) ok('hwid < trial < main.js'); else bad('ordre hwid/trial/main incorrect');
for (const s of order) if (!fs.existsSync(s.replace(/^\.\//, ''))) bad('script référencé introuvable : ' + s);

// ---------------------------------------------------------------------------
console.log('\n8. Elements que j ai ajoutes cette semaine : presents et cables ?');
for (const [id, where] of [['parent-folder-enable', 'main.js'], ['parent-folder-name', 'main.js'], ['export-btn', 'main.js']]) {
    if (htmlIds.has(id) && main.includes(`getElementById('${id}')`)) ok(`#${id} présent dans le HTML et câblé`); else bad(`#${id} manquant ou non câblé`);
}
if (!htmlIds.has('generate-btn') && !htmlIds.has('btn-rerun-mockups')) ok('#generate-btn et #btn-rerun-mockups bien supprimés du HTML'); else bad('bouton supprimé encore présent');
for (const fn of ['handleAction', 'getExportReadiness', 'resolveOutputTarget', 'confirmNoExportConfigured', 'waitForPresentationCompletion', 'fetchFontStylesFromIllustrator', 'evalScriptJson']) {
    if (defined.includes(fn)) ok(`${fn}() définie`); else bad(`${fn}() introuvable`);
}
for (const fn of ['resolveSourceDocument', 'isDocumentOpen', 'writePresentationStatus', 'presentationStatusSnippet', 'presentationDoneSnippet', 'clearStoredSelections']) {
    if (jsxFns.has(fn)) ok(`jsx ${fn}() définie`); else bad(`jsx ${fn}() introuvable`);
}
if (/if \(typeof JSON === 'undefined'\)/.test(jsx) && jsx.indexOf("typeof JSON === 'undefined'") < jsx.indexOf('var storedSelections')) ok('polyfill JSON en tête de hostscript.jsx'); else bad('polyfill JSON absent ou mal placé');

console.log(`\n${problems} problème(s), ${warnings} avertissement(s)\n`);
process.exit(problems ? 1 : 0);
