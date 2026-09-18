// settleScreensExport() (jsx/hostscript.jsx) avec un faux système de fichiers ExtendScript :
// les SVG / PDF exportés « pour les écrans » finissent dans <couleur>/<FMT>/<nom>.<ext>, que la
// préférence Illustrator « Créer des sous-dossiers » soit active ou non (bug client du
// 2026-09-18 : SVG à la racine du dossier couleur), et l'ancien nom doublé est corrigé.
const fs = require('fs');
const src = fs.readFileSync('jsx/hostscript.jsx', 'utf8');
const m = src.match(/function settleScreensExport\([\s\S]*?\r?\n}\r?\n/);
if (!m) throw new Error('settleScreensExport introuvable');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}

// Faux disque : ensemble de chemins de fichiers + ensemble de dossiers.
function disk(files) {
    const state = { files: new Set(files), folders: new Set() };
    const norm = (p) => p.replace(/\\/g, '/').replace(/\/+/g, '/');
    const parent = (p) => norm(p).replace(/\/[^/]+$/, '');
    for (const f of state.files) { let d = parent(f); while (d.includes('/')) { state.folders.add(d); d = parent(d); } }
    function File(p) { this.fsName = norm(p); this.name = this.fsName.split('/').pop(); }
    Object.defineProperty(File.prototype, 'exists', { get() { return state.files.has(this.fsName); } });
    Object.defineProperty(File.prototype, 'parent', { get() { return new Folder(parent(this.fsName)); } });
    File.prototype.copy = function (dest) { if (!state.files.has(this.fsName)) return false; if (!state.folders.has(parent(norm(dest)))) return false; state.files.add(norm(dest)); return true; };
    File.prototype.remove = function () { return state.files.delete(this.fsName); };
    function Folder(p) { this.fsName = norm(p); }
    Object.defineProperty(Folder.prototype, 'exists', { get() { return state.folders.has(this.fsName); } });
    Folder.prototype.create = function () { state.folders.add(this.fsName); return true; };
    Folder.prototype.getFiles = function () { const pre = this.fsName + '/'; return [...state.files, ...state.folders].filter(p => p.startsWith(pre) && !p.slice(pre.length).includes('/')); };
    Folder.prototype.remove = function () { return state.folders.delete(this.fsName); };
    const settle = new Function('File', 'Folder', '$', m[0] + '\nreturn settleScreensExport;')(File, Folder, { writeln() {} });
    return { state, settle, list: () => [...state.files].sort() };
}
const C = 'C:/out/horizontal/original';

console.log('\n--- préférence « sous-dossiers » désactivée : le SVG est à la racine du dossier couleur ---');
let d = disk([C + '/horizontal_fit_original.svg']);
check('rangé dans SVG/', [d.settle(C, 'svg', 'horizontal_fit_original', 'horizontal_fit_original'), d.list()], [true, [C + '/SVG/horizontal_fit_original.svg']]);

console.log('\n--- préférence activée : déjà dans SVG/, rien à faire ---');
d = disk([C + '/SVG/horizontal_fit_original.svg']);
check('inchangé', [d.settle(C, 'svg', 'horizontal_fit_original', 'horizontal_fit_original'), d.list()], [true, [C + '/SVG/horizontal_fit_original.svg']]);

console.log('\n--- ancien nom doublé (préfixe = nom du plan de travail) ---');
d = disk([C + '/SVG/horizontal_fit_originalhorizontal_fit_original.svg']);
check('renommé proprement', [d.settle(C, 'svg', 'horizontal_fit_original', 'horizontal_fit_original'), d.list()], [true, [C + '/SVG/horizontal_fit_original.svg']]);

console.log('\n--- dossier PDF/PDF imbriqué ---');
d = disk([C + '/PDF/PDF/icon_square_original.pdf']);
check('remonté dans PDF/, dossier vide supprimé', [d.settle(C, 'pdf', 'icon_square_original', 'icon_square_original'), d.list(), d.state.folders.has(C + '/PDF/PDF')], [true, [C + '/PDF/icon_square_original.pdf'], false]);

console.log('\n--- nom de plan de travail différent du nom de fichier assaini ---');
d = disk([C + '/a:b.svg']);
check('retrouvé sous le nom brut, rangé sous le nom assaini', [d.settle(C, 'svg', 'a:b', 'a_b'), d.list()], [true, [C + '/SVG/a_b.svg']]);

console.log('\n--- rien exporté : false, dossier SVG/ tout de même créé ---');
d = disk([]);
d.state.folders.add(C);
check('false', [d.settle(C, 'svg', 'x', 'x'), d.state.folders.has(C + '/SVG')], [false, true]);

console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
