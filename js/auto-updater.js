/**
 * Mise à jour à chaud du plugin : télécharge les fichiers listés par un manifeste
 * SIGNÉ, vérifie chaque SHA-256, puis remplace les fichiers en place.
 *
 * Deux phases, comme scripts/release.js : TOUT est téléchargé et vérifié dans un
 * dossier temporaire avant qu'un seul fichier de l'extension ne soit touché. Un
 * échec de remplacement restaure les sauvegardes et ne laisse ni .backup ni .pending.
 *
 * Ce qui n'est PAS couvert : les templates InDesign et les PSD (400 Mo) et le
 * binaire de notarisation. Une release qui les modifie exige l'installeur ; c'est
 * le rôle du champ `hotUpdateFrom` du manifeste (cf. js/updater.js).
 *
 * Ce fichier tourne dans CEF (Node activé) ET dans Node pur pour les tests :
 * aucune référence au DOM ici.
 */

const AutoUpdater = {
    // Clé publique de vérification du manifeste. La clé privée correspondante est
    // apple-cert/update-manifest.key (hors git). Changer cette clé = passer par
    // l'installeur pour tout le monde : les clients installés ne connaissent que
    // celle-ci.
    PUBLIC_KEY_PEM: [
        '-----BEGIN PUBLIC KEY-----',
        'MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAzoOMzOrkRO4Ps1XGar8K',
        'dut7bfYHB+2uuS5khUjpxvdbCQ9ScaWUPbu3ah4ihjjJPJLjawlk3IrEgbW3LKNN',
        'GwDz+wCdgplY/+9KoqGiqO6bbJdQpd4kjDUOxeLZ3hlNDwRD6U70acmjn/fw38oI',
        'cDP2lrobI9WgDqJvO2Ot8zVFiaz7XTfvqiPFkaxl+bRObCUjacYUcwO8x8kt4RWe',
        'M7AFXfX4k95t36ntkTb+k8Fn2UAq74vGoEkLa/sKm71hbspc8sdNzR6TIDpcAoui',
        'K90TEO+35QjaHjPlbDwdjbcJRIY55PqXTzUILhUlJc3Cu9EbWvNoSv3/X7EcpDBU',
        'LfPu9M9To9WUdM1knyqNdPElptRkgH2RlQXH2v4MYWDaujVda8OnYBCsiHapJ3zo',
        'ZAE9LQbjOyIwYnMBEws17uenWmhFe8z/VvyAKfZ6HWw51UnW4Jiobtyo8hu8GUn/',
        'DM2NYA5ggOBww81SYGLC5Gs5AVci236fEBfxIQa9dXsnAgMBAAE=',
        '-----END PUBLIC KEY-----'
    ].join('\n'),

    // Emplacements que la mise à jour à chaud a le droit de toucher. Tout chemin du
    // manifeste hors de cette liste est refusé : un manifeste, même signé, ne peut
    // pas écrire ailleurs.
    ALLOWED_PREFIXES: ['index.html', 'css/', 'js/', 'jsx/', 'CSXS/', 'lib/', 'media/'],

    // Aucun fichier du panneau n'approche cette taille (le plus gros, hostscript.jsx,
    // fait ~160 Ko). Garde-fou contre un manifeste ou un serveur aberrant.
    MAX_FILE_BYTES: 20 * 1024 * 1024,

    getExtensionPath: function () {
        if (typeof __dirname !== 'undefined' && __dirname) return __dirname;
        // Repli : CEP connaît toujours le dossier de l'extension, même sans __dirname.
        if (typeof CSInterface !== 'undefined' && typeof SystemPath !== 'undefined') {
            const p = new CSInterface().getSystemPath(SystemPath.EXTENSION);
            if (p) return p;
        }
        throw new Error('dossier de l\'extension introuvable (Node inactif dans ce panneau ?)');
    },

    // ---- Manifeste ---------------------------------------------------------------

    // Forme canonique : clés triées récursivement, sans espaces, champ `signature`
    // exclu. DOIT rester identique à canonicalManifest() dans scripts/release.js.
    canonicalManifest: function (manifest) {
        function sort(v) {
            if (Array.isArray(v)) return v.map(sort);
            if (v && typeof v === 'object') {
                const out = {};
                Object.keys(v).sort().forEach(function (k) { out[k] = sort(v[k]); });
                return out;
            }
            return v;
        }
        const copy = Object.assign({}, manifest);
        delete copy.signature;
        return JSON.stringify(sort(copy));
    },

    verifyManifestSignature: function (manifest, publicKeyPem) {
        try {
            if (!manifest || typeof manifest.signature !== 'string' || !manifest.signature) return false;
            const crypto = require('crypto');
            const v = crypto.createVerify('RSA-SHA256');
            v.update(this.canonicalManifest(manifest), 'utf8');
            return v.verify(publicKeyPem || this.PUBLIC_KEY_PEM, manifest.signature, 'base64');
        } catch (e) {
            return false;
        }
    },

    // Un chemin du manifeste est-il acceptable ? Relatif, sans remontée, dans la liste.
    isAllowedPath: function (relPath) {
        if (typeof relPath !== 'string' || !relPath) return false;
        const p = relPath.replace(/\\/g, '/');
        if (p.indexOf('..') >= 0 || p.charAt(0) === '/' || /^[A-Za-z]:/.test(p)) return false;
        for (let i = 0; i < this.ALLOWED_PREFIXES.length; i++) {
            const a = this.ALLOWED_PREFIXES[i];
            if (a.charAt(a.length - 1) === '/' ? p.indexOf(a) === 0 : p === a) return true;
        }
        return false;
    },

    // Valide la liste de fichiers : chemins autorisés et uniques, sha256 et taille
    // bien formés. Renvoie un message d'erreur, ou null si tout est bon.
    validateFiles: function (files) {
        if (!Array.isArray(files) || !files.length) return 'manifeste sans fichiers';
        const seen = {};
        for (let i = 0; i < files.length; i++) {
            const f = files[i] || {};
            const label = typeof f.path === 'string' ? f.path : '?';
            if (!this.isAllowedPath(f.path)) return 'entrée de manifeste refusée : ' + label;
            if (!/^[0-9a-f]{64}$/.test(f.sha256 || '')) return 'entrée de manifeste refusée : ' + label;
            if (typeof f.size !== 'number' || !isFinite(f.size) || f.size < 0 || f.size !== Math.floor(f.size) || f.size > this.MAX_FILE_BYTES) return 'entrée de manifeste refusée : ' + label;
            const key = f.path.replace(/\\/g, '/');
            if (seen[key]) return 'chemin en double dans le manifeste : ' + label;
            seen[key] = true;
        }
        return null;
    },

    // ---- Système de fichiers ------------------------------------------------------

    isExtensionWritable: function (dir) {
        const fs = require('fs');
        const path = require('path');
        const probe = path.join(dir, '.write-probe-' + process.pid);
        try {
            fs.writeFileSync(probe, 'ok');
            fs.unlinkSync(probe);
            return true;
        } catch (e) {
            return false;
        }
    },

    sha256File: function (filePath) {
        return new Promise(function (resolve, reject) {
            try {
                const fs = require('fs');
                const crypto = require('crypto');
                const hash = crypto.createHash('sha256');
                const stream = fs.createReadStream(filePath);
                stream.on('data', function (d) { hash.update(d); });
                stream.on('end', function () { resolve(hash.digest('hex')); });
                stream.on('error', reject);
            } catch (e) {
                reject(e);
            }
        });
    },

    // Téléchargement HTTPS simple (pas de redirection : le serveur Vercel répond
    // directement). Délai d'inactivité de 60 s ; la réponse est coupée dès qu'elle
    // dépasse `maxBytes` (la taille signée dans le manifeste) ; une connexion coupée
    // en plein corps rejette au lieu de laisser la promesse en suspens.
    downloadToFile: function (url, destPath, maxBytes) {
        return new Promise(function (resolve, reject) {
            const fs = require('fs');
            const https = require('https');
            const pipeline = require('stream').pipeline;
            const limit = typeof maxBytes === 'number' && maxBytes >= 0 ? maxBytes : AutoUpdater.MAX_FILE_BYTES;
            let settled = false;
            const fail = function (err) {
                if (settled) return;
                settled = true;
                try { fs.unlinkSync(destPath); } catch (e) {}
                reject(err);
            };
            const req = https.get(url, function (res) {
                if (res.statusCode !== 200) { res.resume(); fail(new Error('HTTP ' + res.statusCode + ' pour ' + url)); return; }
                let received = 0;
                res.on('data', function (chunk) {
                    received += chunk.length;
                    if (received > limit) req.destroy(new Error('taille inattendue pour ' + url));
                });
                res.on('aborted', function () { fail(new Error('téléchargement interrompu pour ' + url)); });
                pipeline(res, fs.createWriteStream(destPath), function (err) {
                    if (err) fail(err);
                    else if (!settled) { settled = true; resolve(); }
                });
            });
            req.setTimeout(60000, function () { req.destroy(new Error('délai dépassé pour ' + url)); });
            req.on('error', fail);
        });
    },

    // Suppression récursive écrite à la main : fs.rmSync n'existe pas dans les Node
    // anciens embarqués par CEP.
    removeDirRecursive: function (dir) {
        const fs = require('fs');
        const path = require('path');
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir).forEach(function (name) {
            const full = path.join(dir, name);
            let st;
            try { st = fs.lstatSync(full); } catch (e) { return; }
            if (st.isDirectory()) AutoUpdater.removeDirRecursive(full);
            else { try { fs.unlinkSync(full); } catch (e) {} }
        });
        try { fs.rmdirSync(dir); } catch (e) {}
    },

    replaceFile: function (sourcePath, destPath) {
        const fs = require('fs');
        const path = require('path');
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.copyFileSync(sourcePath, destPath);
            return 'SUCCESS';
        } catch (e) {
            if (e.code === 'EBUSY' || e.code === 'EPERM') {
                // Fichier verrouillé (Windows) : déposé à côté, appliqué au prochain
                // démarrage par js/pending-updates.js, avant tout autre script.
                fs.copyFileSync(sourcePath, destPath + '.pending');
                return 'RESTART_REQUIRED';
            }
            throw e;
        }
    },

    // ---- Application ---------------------------------------------------------------

    /**
     * opts : { extensionPath, filesBaseUrl, fetch(url, destPath, maxBytes), publicKeyPem,
     *          onProgress(step, current, total, file) }
     * Retourne { success, filesUpdated: [], needsRestart, error }.
     */
    applyUpdate: async function (manifest, opts) {
        const fs = require('fs');
        const path = require('path');
        opts = opts || {};
        const extensionPath = opts.extensionPath || this.getExtensionPath();
        const fetch = opts.fetch || this.downloadToFile;
        const onProgress = opts.onProgress || function () {};
        const result = { success: false, filesUpdated: [], needsRestart: false, error: null };

        // 0. Le manifeste est-il authentique et sain ?
        if (!this.verifyManifestSignature(manifest, opts.publicKeyPem)) {
            result.error = 'signature du manifeste invalide';
            return result;
        }
        const invalid = this.validateFiles(manifest.files);
        if (invalid) {
            result.error = invalid;
            return result;
        }
        if (!this.isExtensionWritable(extensionPath)) {
            result.error = 'dossier de l\'extension non modifiable';
            return result;
        }

        const tempDir = path.join(extensionPath, '.temp_update');
        this.removeDirRecursive(tempDir);
        fs.mkdirSync(tempDir, { recursive: true });
        const total = manifest.files.length;
        const staged = [];

        try {
            // 1. Tout télécharger et tout vérifier AVANT de toucher à l'extension. Un
            //    fichier local déjà identique (même SHA-256) n'est ni téléchargé ni
            //    remplacé : la plupart des releases ne touchent que quelques fichiers.
            for (let i = 0; i < total; i++) {
                const f = manifest.files[i];
                onProgress('download', i + 1, total, f.path);
                const dest = path.join(extensionPath, f.path);
                if (fs.existsSync(dest)) {
                    let local = null;
                    try { local = await this.sha256File(dest); } catch (e) {}
                    if (local === f.sha256) continue;
                }
                // Nom temporaire indexé : deux entrées ne peuvent pas se marcher dessus.
                const tmp = path.join(tempDir, i + '-' + path.basename(f.path));
                const url = (opts.filesBaseUrl || '') + encodeURIComponent(f.path);
                await fetch(url, tmp, f.size);
                if (fs.statSync(tmp).size !== f.size) throw new Error('taille inattendue pour ' + f.path);
                const digest = await this.sha256File(tmp);
                if (digest !== f.sha256) throw new Error('empreinte incorrecte pour ' + f.path);
                staged.push({ rel: f.path, tmp: tmp, dest: dest });
            }

            // 2. Remplacer, avec sauvegarde de chaque original. En cas d'échec : restaurer
            //    les originaux, supprimer les fichiers créés ET les .pending déposés, pour
            //    que js/pending-updates.js n'applique pas une moitié de version au
            //    prochain démarrage.
            const backups = [];
            const created = [];
            try {
                for (let i = 0; i < staged.length; i++) {
                    const s = staged[i];
                    onProgress('install', i + 1, staged.length, s.rel);
                    if (fs.existsSync(s.dest)) {
                        fs.copyFileSync(s.dest, s.dest + '.backup');
                        backups.push(s.dest);
                    } else {
                        created.push(s.dest);
                    }
                    const r = this.replaceFile(s.tmp, s.dest);
                    if (r === 'RESTART_REQUIRED') result.needsRestart = true;
                    result.filesUpdated.push(s.rel);
                }
            } catch (e) {
                backups.forEach(function (dest) {
                    try {
                        if (fs.existsSync(dest)) fs.unlinkSync(dest);
                        fs.copyFileSync(dest + '.backup', dest);
                    } catch (e2) {}
                });
                backups.forEach(function (dest) { try { fs.unlinkSync(dest + '.backup'); } catch (e2) {} });
                created.forEach(function (dest) { try { fs.unlinkSync(dest); } catch (e2) {} });
                staged.forEach(function (s) { try { fs.unlinkSync(s.dest + '.pending'); } catch (e2) {} });
                result.filesUpdated = [];
                result.needsRestart = false;
                throw e;
            }
            backups.forEach(function (dest) { try { fs.unlinkSync(dest + '.backup'); } catch (e2) {} });

            result.success = true;
            // hostscript.jsx est chargé une fois par session Illustrator : toujours relancer.
            result.needsRestart = true;
            return result;
        } catch (e) {
            result.error = e.message || String(e);
            return result;
        } finally {
            this.removeDirRecursive(tempDir);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoUpdater;
}
