// Transfert d'un élément vers le document d'export (jsx/hostscript.jsx), exécuté ici avec
// un faux DOM Illustrator. Régression visée : Illustrator ne rafraîchit pas
// targetDoc.pageItems.length après la duplication d'un GROUPE (mesuré le 2026-09-17), donc
// l'arrivée de la copie se vérifie par son document propriétaire, jamais par ce compteur.
const fs = require('fs');
const src = fs.readFileSync('jsx/hostscript.jsx', 'utf8');

function grab(startMarker, endMarker) {
    const a = src.indexOf(startMarker), b = src.indexOf(endMarker, a + 1);
    if (a < 0 || b < 0) throw new Error('bloc introuvable : ' + startMarker);
    return src.slice(a, b);
}
// Une fonction top-level entière : de « function nom( » à la première accolade fermante en colonne 0.
function grabFunction(name) {
    const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\r?\\n}\\r?\\n'));
    if (!m) throw new Error('fonction introuvable : ' + name);
    return m[0];
}
const code = grabFunction('isSameDocument') + '\n' +
             grab('function transferTargetLayer(', '// Générer les artboards');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}

// Faux DOM minimal.
function world() {
    const targetDoc = { typename: 'Document', name: 'Sans titre-2', selection: [], pageItems: { length: 1 } /* compteur FIGÉ */ };
    const targetLayer = { typename: 'Layer', name: 'Calque 1', locked: false, visible: true, parent: targetDoc };
    targetDoc.layers = [targetLayer]; targetDoc.layers.add = () => targetLayer; targetDoc.activeLayer = targetLayer;
    const sourceDoc = { typename: 'Document', name: 'logo.ai', selection: [] };
    const sourceLayer = { typename: 'Layer', name: 'Logo', locked: false, visible: true, parent: sourceDoc };
    const calls = { copy: 0, paste: 0, removed: 0, moved: 0 };
    const app = { activeDocument: sourceDoc, copy() { calls.copy++; }, paste() { calls.paste++; } };
    return { targetDoc, targetLayer, sourceDoc, sourceLayer, calls, app };
}
function load(w, validate) {
    return new Function('app', 'ElementPlacement', '$', 'validateElement',
        code + '\nreturn { transferElementToDocument: transferElementToDocument, ownerDocumentOf: ownerDocumentOf };')(
        w.app, { PLACEATBEGINNING: 1, PLACEATEND: 2 }, { writeln() {} }, validate || (() => ({ valid: true, error: '' })));
}
function item(w, layer) {
    const it = { typename: 'GroupItem', hidden: true, selected: false, layer, remove() { w.calls.removed++; } };
    return it;
}

console.log('\n--- groupe : compteur pageItems figé, mais la copie est dans la cible ---');
let w = world(), api = load(w);
let el = item(w, w.sourceLayer);
el.duplicate = (target) => item(w, target || w.sourceLayer);
let reasons = [];
let r = api.transferElementToDocument(el, w.sourceDoc, w.targetDoc, 'version verticale', reasons);
check('copie acceptée (avant le fix : rejetée puis supprimée)', [!!r, r && r.layer === w.targetLayer, r && r.hidden], [true, true, true]);
check('copie jamais supprimée, presse-papiers jamais utilisé', [w.calls.removed, w.calls.copy, w.calls.paste], [0, 0, 0]);
check('aucune cause d échec remontée', reasons, []);

console.log('\n--- sous-calque : le propriétaire se trouve en remontant les parents ---');
w = world(); api = load(w);
const sub = { typename: 'Layer', name: 'sous-calque', parent: w.targetLayer };
check('ownerDocumentOf traverse les sous-calques', api.ownerDocumentOf({ layer: sub }) === w.targetDoc, true);
check('élément sans calque → null', api.ownerDocumentOf({}), null);

console.log('\n--- la copie reste dans la source, move() la rattrape ---');
w = world(); api = load(w);
el = item(w, w.sourceLayer);
el.duplicate = () => { const d = item(w, w.sourceLayer); d.move = (target) => { w.calls.moved++; d.layer = target; }; return d; };
r = api.transferElementToDocument(el, w.sourceDoc, w.targetDoc, 'icône', []);
check('déplacée dans la cible, sans presse-papiers', [!!r, w.calls.moved, r && r.layer === w.targetLayer, w.calls.copy], [true, 1, true, 0]);

console.log('\n--- copie coincée dans la source : repli presse-papiers réussi ---');
w = world(); api = load(w);
el = item(w, w.sourceLayer);
let n = 0;
el.duplicate = () => { n++; const d = item(w, w.sourceLayer); d.move = () => { throw new Error('move impossible'); }; return d; };
const pasted = item(w, w.targetLayer);
w.app.paste = () => { w.calls.paste++; w.targetDoc.selection = [pasted]; };
r = api.transferElementToDocument(el, w.sourceDoc, w.targetDoc, 'typographie', []);
check('transféré par le presse-papiers', [r === pasted, w.calls.copy, w.calls.paste, pasted.hidden], [true, 1, 1, true]);
check('les deux copies temporaires de la source sont retirées', w.calls.removed, 2);

console.log('\n--- tout échoue : null + cause lisible avec l étape ---');
w = world(); api = load(w);
el = item(w, w.sourceLayer);
el.duplicate = (target) => { if (target) throw new Error('refus Illustrator'); return item(w, w.sourceLayer); };
w.app.copy = () => { throw new Error('an Illustrator error occurred: 2'); };
reasons = [];
r = api.transferElementToDocument(el, w.sourceDoc, w.targetDoc, 'version verticale', reasons);
check('null', r, null);
check('une cause, nommant l élément, la duplication et l étape « copie »',
    [reasons.length, /version verticale/.test(reasons[0]), /duplication directe refusée \(refus Illustrator\)/.test(reasons[0]), /étape « copie »/.test(reasons[0])], [1, true, true, true]);

console.log('\n--- élément invalide : refusé avant tout transfert ---');
w = world(); api = load(w, () => ({ valid: false, error: 'L\'élément est verrouillé.' }));
reasons = [];
r = api.transferElementToDocument(item(w, w.sourceLayer), w.sourceDoc, w.targetDoc, 'icône', reasons);
check('null + message de validation', [r, reasons], [null, ['icône (L\'élément est verrouillé.)']]);

console.log(`\n${pass} OK, ${fail} echec(s)\n`);
process.exit(fail ? 1 : 0);
