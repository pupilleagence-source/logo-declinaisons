// Exerce le vrai suivi de fin de presentation extrait de js/main.js, avec des fichiers de
// statut ecrits par un timer pour simuler Photoshop puis InDesign.
const fs = require('fs');
const path = require('path');
const os = require('os');

const src = fs.readFileSync('js/main.js', 'utf8');

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
const consts = src.match(/const PRESENTATION_STATUS_FILE[^\n]*\n(?:const PRESENTATION_[^\n]*\n)*/)[0];
const names = ['readPresentationStatus', 'clearPresentationStatus', 'waitForPresentationCompletion',
               'describePresentationPhase', 'describePresentationOutcome'];
const code = consts + names.map(extractFn).join('\n') + '\nreturn {' + names.join(',') + ', PRESENTATION_STATUS_FILE};';
const H = new Function('require', code)(require);

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Ecrit le statut exactement comme les scripts ExtendScript generes (chaine construite,
// pas JSON.stringify) — pour verifier que le format qu'ils produisent est bien lu.
function writeStatus(dir, phase, extra, ts) {
    const body = '{"phase":"' + phase + '","ts":' + (ts || Date.now()) + (extra || '') + '}';
    fs.writeFileSync(path.join(dir, H.PRESENTATION_STATUS_FILE), body);
}

(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logopack-status-'));

    console.log('\n--- Lecture du format ecrit par ExtendScript ---');
    writeStatus(root, 'photoshop', ',"mockupsDone":3,"mockupsTotal":9');
    const st = H.readPresentationStatus(root);
    check('phase',        st.phase, 'photoshop');
    check('mockupsDone',  st.mockupsDone, 3);
    check('mockupsTotal', st.mockupsTotal, 9);
    check('ts numerique', typeof st.ts, 'number');
    writeStatus(root, 'error', '', Date.now());
    fs.writeFileSync(path.join(root, H.PRESENTATION_STATUS_FILE), '{"phase":"indesign","ts":12');  // tronque
    check('JSON tronque -> null (on reessaiera)', H.readPresentationStatus(root), null);
    H.clearPresentationStatus(root);
    check('clear supprime le fichier', fs.existsSync(path.join(root, H.PRESENTATION_STATUS_FILE)), false);
    check('absent -> null', H.readPresentationStatus(root), null);

    console.log('\n--- Scenario complet : residu ancien ignore, PS 0/2 -> 2/2, ID, done ---');
    writeStatus(root, 'done', ',"mockupsOk":99', Date.now() - 60000);   // residu d'un run precedent
    const startedAt = Date.now();
    const seen = [];
    const p = H.waitForPresentationCompletion(root, {
        startedAt, timeoutMs: 5000, intervalMs: 30,
        onProgress: (s) => seen.push(s.phase + (s.mockupsDone !== undefined ? ' ' + s.mockupsDone + '/' + s.mockupsTotal : ''))
    });
    await sleep(80);  writeStatus(root, 'photoshop', ',"mockupsDone":0,"mockupsTotal":2');
    await sleep(80);  writeStatus(root, 'photoshop', ',"mockupsDone":1,"mockupsTotal":2');
    await sleep(80);  writeStatus(root, 'photoshop', ',"mockupsDone":2,"mockupsTotal":2');
    await sleep(80);  writeStatus(root, 'indesign', ',"mockupsOk":2,"mockupsFailed":0');
    await sleep(80);  writeStatus(root, 'done', ',"mockupsOk":2,"mockupsFailed":0');
    const fin = await p;
    check('le residu "done" ancien n a PAS clos l attente', seen[0] !== 'done', true);
    check('progression vue dans l ordre', seen, ['photoshop 0/2', 'photoshop 1/2', 'photoshop 2/2', 'indesign', 'done']);
    check('resolu en done', fin.phase, 'done');
    check('compteurs conserves', [fin.mockupsOk, fin.mockupsFailed], [2, 0]);

    console.log('\n--- Erreur signalee par un script ---');
    H.clearPresentationStatus(root);
    const p2 = H.waitForPresentationCompletion(root, { startedAt: Date.now(), timeoutMs: 5000, intervalMs: 30 });
    await sleep(60); writeStatus(root, 'error', ',"message":"IDML introuvable"');
    const fin2 = await p2;
    check('resolu en error', fin2.phase, 'error');
    check('message transmis', fin2.message, 'IDML introuvable');

    console.log('\n--- Timeout : rien n arrive jamais ---');
    H.clearPresentationStatus(root);
    const t0 = Date.now();
    const fin3 = await H.waitForPresentationCompletion(root, { startedAt: t0, timeoutMs: 200, intervalMs: 30 });
    check('resolu en timeout', fin3.phase, 'timeout');
    check('sans depasser de beaucoup', Date.now() - t0 < 1000, true);

    console.log('\n--- Libelles ---');
    check('phase PS avec compteur', H.describePresentationPhase({ phase: 'photoshop', mockupsDone: 3, mockupsTotal: 9 }), 'Photoshop : mockup 3/9…');
    check('phase PS sans compteur', H.describePresentationPhase({ phase: 'photoshop' }), 'Photoshop : traitement des mockups…');
    check('bilan done 9/9 -> success', H.describePresentationOutcome({ phase: 'done', mockupsOk: 9, mockupsFailed: 0 }).level, 'success');
    check('bilan done 7/9 -> warning', H.describePresentationOutcome({ phase: 'done', mockupsOk: 7, mockupsFailed: 2 }).level, 'warning');
    check('bilan done sans mockups -> success', H.describePresentationOutcome({ phase: 'done' }), { text: 'Présentation InDesign prête.', level: 'success' });
    check('bilan timeout -> warning', H.describePresentationOutcome({ phase: 'timeout' }).level, 'warning');
    check('bilan null -> warning', H.describePresentationOutcome(null).level, 'warning');

    fs.rmSync(root, { recursive: true, force: true });
    console.log(`\n${pass} OK, ${fail} echec(s)\n`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
