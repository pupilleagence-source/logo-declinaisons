// Le moteur ExtendScript d'Illustrator n'a pas d'objet JSON. jsx/hostscript.jsx en
// embarque un polyfill ES3 en tete de fichier ; on l'execute ici avec JSON masque et
// on compare sa sortie au JSON natif de Node sur des cas realistes.
const fs = require('fs');
const src = fs.readFileSync('jsx/hostscript.jsx', 'utf8');

const start = src.indexOf('//  Polyfill JSON');
const end = src.indexOf('var storedSelections = {');
if (start < 0 || end < 0) throw new Error('bloc polyfill introuvable');
const block = src.slice(src.lastIndexOf('\n', start) + 1, end);

// `JSON` est un parametre de la Function, donc `JSON = {}` dans le polyfill assigne
// bien ce parametre (typeof undefined -> polyfill actif), sans toucher au JSON global.
const Poly = new Function('JSON', block + '\nreturn JSON;')(undefined);

let pass = 0, fail = 0;
function same(label, value) {
    const expected = JSON.stringify(value);
    let actual;
    try { actual = Poly.stringify(value); } catch (e) { actual = 'THROW ' + e.message; }
    const ok = actual === expected;
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `\n           polyfill : ${actual}\n           natif    : ${expected}`));
    ok ? pass++ : fail++;
}
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}

console.log('\n--- Les retours reels de hostscript.jsx ---');
same('{success:true}',                           { success: true });
same('{success:true,status:processing}',         { success: true, status: 'processing' });
same('{success:false,error:...} avec e.toString()', { success: false, error: "Error 2: JSON n'est pas défini. Line: 3529 -> return JSON.stringify({ success: false, error: e.toString() });" });
same('enablePlayerDebugMode : objet imbrique',   { success: true, platform: 'windows', message: 'x', details: { versions: [9, 10, 11, 12], enabled: true } });

console.log('\n--- Echappement des chaines ---');
same('guillemets et antislashs (chemin Windows)', { p: 'C:\\Users\\O\'Brien\\"dossier"' });
same('retours a la ligne, tabulation',            { m: 'ligne 1\nligne 2\r\n\tindent' });
same('caracteres de controle < 32',               { c: 'a\u0001b\u001fc\u0000d' });
same('backspace / form feed',                     { c: '\b\f' });
same('accents et unicode conserves tels quels',   { s: 'déclinaisons – « Générer » ✓ 🎨' });
same('chaine vide',                               { s: '' });

console.log('\n--- Types ---');
same('nombres : entier, flottant, negatif, zero', [1, 2.5, -3, 0, 1e21, 0.1]);
same('NaN et Infinity -> null',                   [NaN, Infinity, -Infinity]);
same('booleens et null',                          [true, false, null]);
same('undefined dans un tableau -> null',         [1, undefined, 2]);
same('undefined / fonction dans un objet -> omis', { a: 1, b: undefined, c: function () {}, d: 2 });
same('tableau vide, objet vide',                  [[], {}]);
same('imbrication profonde',                      { a: [{ b: [{ c: { d: [1, [2, [3]]] } }] }] });
same('valeur racine : chaine',                    'seule');
same('valeur racine : nombre',                    42);
same('valeur racine : null',                      null);
check('valeur racine : undefined -> undefined',   Poly.stringify(undefined), undefined);

console.log('\n--- parse (repli eval, entrees de confiance) ---');
check('objet',            Poly.parse('{"a":1,"b":[true,null,"x"]}'), { a: 1, b: [true, null, 'x'] });
check('tableau',          Poly.parse(' [1,2,3] '), [1, 2, 3]);
check('aller-retour',     Poly.parse(Poly.stringify({ s: 'a"b\\c\nd', n: [1, { k: null }] })), { s: 'a"b\\c\nd', n: [1, { k: null }] });
let threw = false; try { Poly.parse('alert(1)'); } catch (e) { threw = true; }
check('refuse ce qui ne commence pas par { ou [', threw, true);

console.log('\n--- ES3 : aucune construction moderne dans le polyfill (commentaires exclus) ---');
const codeOnly = block.replace(/\/\/[^\n]*/g, '');
check('pas de let/const/arrow/map/forEach/isArray', /\b(let|const)\b|=>|\.map\(|\.forEach\(|Array\.isArray/.test(codeOnly), false);

console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
