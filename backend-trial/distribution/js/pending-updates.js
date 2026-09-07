/**
 * Chargé EN PREMIER (dans <head>, avant tout autre script) : applique les fichiers
 * "*.pending" qu'une mise à jour à chaud a laissés quand Windows verrouillait
 * l'original. Fait ici, de façon synchrone, pour que les scripts chargés juste
 * après soient déjà les nouveaux — sinon il fallait relancer deux fois.
 *
 * Volontairement autonome : js/auto-updater.js n'est pas encore chargé à ce moment-là.
 * Dans le panneau (CEP : `window` ET `module` existent) le corps s'exécute tout de
 * suite ; sous Node pur (tests) la fonction est exportée à la place.
 */
function applyPendingUpdates(root) {
    var count = 0;
    try {
        if (typeof require !== 'function' || !root) return 0;
        var fs = require('fs');
        var path = require('path');
        var roots = ['index.html', 'css', 'js', 'jsx', 'CSXS', 'lib', 'media'];
        function apply(pending) {
            var target = pending.slice(0, -8);
            try {
                if (fs.existsSync(target)) fs.unlinkSync(target);
                fs.renameSync(pending, target);
                count++;
            } catch (e) {}
        }
        function visit(dir) {
            var names;
            try { names = fs.readdirSync(dir); } catch (e) { return; }
            for (var i = 0; i < names.length; i++) {
                var full = path.join(dir, names[i]);
                var st;
                try { st = fs.lstatSync(full); } catch (e) { continue; }
                if (st.isDirectory()) visit(full);
                else if (names[i].length > 8 && names[i].slice(-8) === '.pending') apply(full);
            }
        }
        for (var r = 0; r < roots.length; r++) {
            var full = path.join(root, roots[r]);
            var st = null;
            try { st = fs.lstatSync(full); } catch (e) {}
            if (st && st.isDirectory()) visit(full);
            else if (fs.existsSync(full + '.pending')) apply(full + '.pending');
        }
        if (count) console.log('🔄 ' + count + ' fichier(s) de mise à jour en attente appliqué(s)');
    } catch (e) {
        console.warn('pending-updates:', e && e.message);
    }
    return count;
}

if (typeof window === 'undefined' && typeof module !== 'undefined' && module.exports) {
    module.exports = applyPendingUpdates;
} else {
    applyPendingUpdates(typeof __dirname !== 'undefined' ? __dirname : null);
}
