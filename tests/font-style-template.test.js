// Integration : applique la vraie replaceStoryFonts() de js/idml-generator.js aux stories
// du vrai templates/template-1.idml, et verifie ce qui a change — et ce qui n'a PAS change.
const fs = require('fs');
const path = require('path');
const JSZip = require('../lib/jszip.min.js');

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
const code = consts + '\n' + ['escXml', 'normalizeStyle', 'resolveFontStyle', 'rewriteFontStyles', 'replaceStoryFonts']
    .map(extractFn).join('\n') + '\nreturn { replaceStoryFonts, rewriteFontStyles };';
const G = new Function(code)();

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}

// Compte les FontStyle par paragraphe englobant dans un XML de story.
function countStyles(xml) {
    const out = {};
    const re = /<ParagraphStyleRange\b([^>]*)>([\s\S]*?)<\/ParagraphStyleRange>/g;
    let pm;
    while ((pm = re.exec(xml))) {
        const ps = /AppliedParagraphStyle="ParagraphStyle\/([^"]*)"/.exec(pm[1]);
        const name = ps ? ps[1] : '?';
        const inner = pm[2].match(/FontStyle="([^"]*)"/g) || [];
        for (const m of inner) {
            const v = m.slice('FontStyle="'.length, -1);
            out[name] = out[name] || {};
            out[name][v] = (out[name][v] || 0) + 1;
        }
    }
    return out;
}

(async () => {
    const buf = fs.readFileSync(path.join('templates', 'template-1.idml'));
    const zip = await JSZip.loadAsync(buf);
    const storyFiles = Object.keys(zip.files).filter(f => /^Stories\/.*\.xml$/.test(f));
    check('le template contient des stories', storyFiles.length > 0, true);

    const before = {}, after = {};
    const subs = [];
    // Scenario : police principale n'a que Regular + Bold ; police secondaire a un style
    // unique sans nom (le cas signale par l'auteur).
    const PRIMARY = ['Regular', 'Bold'];
    const SECONDARY = [''];

    for (const f of storyFiles) {
        let xml = await zip.file(f).async('string');
        const b = countStyles(xml);
        for (const k in b) { before[k] = before[k] || {}; for (const v in b[k]) before[k][v] = (before[k][v] || 0) + b[k][v]; }

        xml = G.replaceStoryFonts(xml, 'BRAND_PRIMARY', 'PoliceA', PRIMARY, subs);
        xml = G.replaceStoryFonts(xml, 'BRAND_SECONDARY', 'PoliceB', SECONDARY, subs);

        const a = countStyles(xml);
        for (const k in a) { after[k] = after[k] || {}; for (const v in a[k]) after[k][v] = (after[k][v] || 0) + a[k][v]; }
    }

    console.log('\n--- Etat AVANT (extrait du template) ---');
    console.log('  ', JSON.stringify(before));
    console.log('--- Etat APRES ---');
    console.log('  ', JSON.stringify(after));

    console.log('\n--- BRAND_PRIMARY (Regular + Bold dispo) ---');
    check('Medium a disparu',              (after.BRAND_PRIMARY || {}).Medium || 0, 0);
    check('Bold conserve',                 (after.BRAND_PRIMARY || {}).Bold || 0, (before.BRAND_PRIMARY || {}).Bold || 0);
    check('Medium est devenu Regular',     (after.BRAND_PRIMARY || {}).Regular || 0, (before.BRAND_PRIMARY || {}).Medium || 0);

    console.log('\n--- BRAND_SECONDARY (style unique "") ---');
    const totalSecBefore = Object.values(before.BRAND_SECONDARY || {}).reduce((a, b) => a + b, 0);
    check('plus aucun Medium ni Italic',   ((after.BRAND_SECONDARY || {}).Medium || 0) + ((after.BRAND_SECONDARY || {}).Italic || 0), 0);
    check('tous les FontStyle valent ""',  (after.BRAND_SECONDARY || {})[''] || 0, totalSecBefore);

    console.log('\n--- NormalParagraphStyle (polices FIXES du template) : INTACT ---');
    check('aucune modification', after['$ID/NormalParagraphStyle'], before['$ID/NormalParagraphStyle']);

    console.log('\n--- Substitutions rapportees ---');
    const dedup = {};
    for (const s of subs) dedup[s.family + '|' + s.requested + '|' + s.used] = 1;
    const keys = Object.keys(dedup).sort();
    console.log('  ', keys.join('\n   '));
    check('PoliceA : Medium -> Regular signale',  keys.includes('PoliceA|Medium|Regular'), true);
    check('PoliceB : Medium -> "" signale',       keys.includes('PoliceB|Medium|'), true);
    check('PoliceB : Italic -> "" signale',       keys.includes('PoliceB|Italic|'), true);
    check('Bold conserve = pas signale',          keys.includes('PoliceA|Bold|Bold'), false);

    console.log(`\n${pass} OK, ${fail} echec(s)\n`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
