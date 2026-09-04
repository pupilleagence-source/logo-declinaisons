// Exerce la vraie resolution de style de police extraite de js/idml-generator.js.
const fs = require('fs');
const src = fs.readFileSync('js/idml-generator.js', 'utf8');

function extractFn(name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('introuvable: ' + name);
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) break; }
    }
    return src.slice(start, i + 1);
}
const consts = src.match(/var REGULAR_GROUP = \[[\s\S]*?\];/)[0] + '\n' + src.match(/var STYLE_FALLBACKS = \{[\s\S]*?\n    \};/)[0];
const code = consts + '\n' + extractFn('normalizeStyle') + '\n' + extractFn('resolveFontStyle') + '\nreturn resolveFontStyle;';
const resolve = new Function(code)();

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}
const r = (req, avail) => { const x = resolve(req, avail); return x.style + (x.substituted ? ' *' : ''); };

console.log('\n--- Police complete : rien ne change ---');
const full = ['Regular', 'Medium', 'Bold', 'Italic', 'Light', 'Bold Italic'];
check('Regular', r('Regular', full), 'Regular');
check('Medium',  r('Medium', full),  'Medium');
check('Italic',  r('Italic', full),  'Italic');
check('Bold Italic (espace)', r('Bold Italic', full), 'Bold Italic');

console.log('\n--- Casse et espaces : on ecrit la forme BRUTE de la police, sans compter comme substitution ---');
check('"SemiBold" demande, police a "Semibold"',  r('SemiBold', ['Regular', 'Semibold']), 'Semibold');
check('"BoldItalic" demande, police a "Bold Italic"', r('BoldItalic', ['Regular', 'Bold Italic']), 'Bold Italic');
check('"regular" minuscule', r('regular', ['Regular']), 'Regular');

console.log('\n--- Police Regular + Bold seulement (le cas le plus courant) ---');
const rb = ['Regular', 'Bold'];
check('Medium -> Regular',      r('Medium', rb),      'Regular *');
check('Light  -> Regular',      r('Light', rb),       'Regular *');
check('Italic -> Regular',      r('Italic', rb),      'Regular *');
check('Bold Italic -> Bold',    r('Bold Italic', rb), 'Bold *');
check('SemiBold -> Bold',       r('SemiBold', rb),    'Bold *');
check('Black -> Bold',          r('Black', rb),       'Bold *');

console.log('\n--- Medium tombe vers Regular, pas vers Bold, quand les deux existent ---');
check('Medium -> Regular (pas Bold)', r('Medium', ['Bold', 'Regular']), 'Regular *');
check('Medium -> SemiBold si dispo',  r('Medium', ['Regular', 'SemiBold', 'Bold']), 'SemiBold *');

console.log('\n--- LE CAS SIGNALE : police a style unique SANS nom de style ([""]) ---');
const blank = [''];
check('Regular -> ""', r('Regular', blank), ' *');
check('Medium  -> ""', r('Medium', blank),  ' *');
check('Italic  -> ""', r('Italic', blank),  ' *');
check('Bold    -> ""', r('Bold', blank),    ' *');
check('"" demande -> "" sans substitution', r('', blank), '');

console.log('\n--- Style unique nomme autrement ---');
check('["Plain"] : Regular -> Plain',   r('Regular', ['Plain']), 'Plain *');
check('["Plain"] : Medium -> Plain',    r('Medium', ['Plain']),  'Plain *');
check('["Book"]  : Regular -> Book',    r('Regular', ['Book']),  'Book *');
check('["Bebas Neue"] (nom = famille) : Medium -> Bebas Neue', r('Medium', ['Bebas Neue']), 'Bebas Neue *');
check('["Italic"] seul : Regular -> Italic (seul style)',      r('Regular', ['Italic']),     'Italic *');

console.log('\n--- Styles numerotes type Helvetica Neue LT ---');
const helv = ['45 Light', '55 Roman', '65 Medium', '75 Bold', '56 Italic'];
check('Regular -> 55 Roman', r('Regular', helv), '55 Roman *');
check('Medium  -> 65 Medium', r('Medium', helv), '65 Medium *');
check('Bold    -> 75 Bold',   r('Bold', helv),   '75 Bold *');
check('Light   -> 45 Light',  r('Light', helv),  '45 Light *');
check('Italic  -> 56 Italic', r('Italic', helv), '56 Italic *');

console.log('\n--- Style hors table : decomposition ---');
check('"Condensed Bold Italic" -> un italique dispo', r('Condensed Bold Italic', ['Regular', 'Italic', 'Bold']), 'Italic *');
check('"ExtraBlack" -> regular par defaut',          r('ExtraBlack', ['Regular', 'Italic']), 'Regular *');

console.log('\n--- Police inconnue d Illustrator : on ne touche a rien ---');
const unk = resolve('Medium', null);
check('style renvoye tel quel', unk.style, 'Medium');
check('known = false',          unk.known, false);
check('liste vide idem',        resolve('Medium', []).known, false);

console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
