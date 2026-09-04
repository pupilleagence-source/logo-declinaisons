// Exerce la vraie chaine de repli extraite de js/idml-generator.js.
const fs = require('fs');
const src = fs.readFileSync('js/idml-generator.js', 'utf8');

const fbSrc = src.match(/var LOGO_TYPE_FALLBACKS = \{[\s\S]*?\};/)[0];
const start = src.indexOf('function resolveLogoWithFallback(');
let depth = 0, i = src.indexOf('{', start), started = false;
for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; started = true; }
    else if (src[i] === '}') { depth--; if (started && depth === 0) break; }
}
const fnSrc = src.slice(start, i + 1);

const make = new Function('scan', fbSrc + '\n' + fnSrc + '\nreturn resolveLogoWithFallback;');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}
const got = (r) => r ? r.usedType : null;

console.log('\n--- Tout est disponible : aucun repli ---');
let r = make({ logos: { horizontal: { original: 'h.svg' }, vertical: { original: 'v.svg' }, text: { original: 't.svg' } } });
check('horizontal -> horizontal', got(r('horizontal', 'original')), 'horizontal');
check('vertical   -> vertical',   got(r('vertical', 'original')),   'vertical');

console.log('\n--- Pas de vertical : le cadre vertical prend l\'horizontal ---');
r = make({ logos: { horizontal: { original: 'h.svg' }, text: { original: 't.svg' } } });
check('vertical   -> horizontal', got(r('vertical', 'original')),   'horizontal');
check('horizontal -> horizontal', got(r('horizontal', 'original')), 'horizontal');

console.log('\n--- Pas d\'horizontal : le cadre horizontal prend le vertical ---');
r = make({ logos: { vertical: { original: 'v.svg' }, text: { original: 't.svg' } } });
check('horizontal -> vertical', got(r('horizontal', 'original')), 'vertical');
check('vertical   -> vertical', got(r('vertical', 'original')),   'vertical');

console.log('\n--- Ni horizontal ni vertical : repli sur la typo ---');
r = make({ logos: { text: { original: 't.svg' }, icon: { original: 'i.svg' } } });
check('horizontal -> text', got(r('horizontal', 'original')), 'text');
check('vertical   -> text', got(r('vertical', 'original')),   'text');

console.log('\n--- La couleur est preservee (jamais de melange) ---');
r = make({ logos: { horizontal: { original: 'h.svg' }, vertical: { monochrome: 'v-mono.svg' }, text: { monochrome: 't-mono.svg' } } });
check('horizontal/monochrome -> vertical/monochrome', got(r('horizontal', 'monochrome')), 'vertical');
check('vertical/original ne prend PAS horizontal/monochrome', got(r('vertical', 'original')), 'horizontal');
r = make({ logos: { horizontal: { original: 'h.svg' } } });
check('vertical/monochrome sans equivalent -> rien', got(r('vertical', 'monochrome')), null);

console.log('\n--- Les autres types ne sont pas concernes ---');
r = make({ logos: { horizontal: { original: 'h.svg' }, text: { original: 't.svg' } } });
check('icon    -> rien (pas de chaine)', got(r('icon', 'original')),    null);
check('custom1 -> rien (pas de chaine)', got(r('custom1', 'original')), null);

console.log('\n--- Aucun logo du tout ---');
r = make({ logos: {} });
check('horizontal -> rien', got(r('horizontal', 'original')), null);

console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
