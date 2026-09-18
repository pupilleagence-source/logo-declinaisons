/**
 * Vérification des mises à jour et modales.
 *
 * Source de vérité : le manifeste SIGNÉ servi par /api/updates/manifest (généré par
 * scripts/release.js). Deux modales, selon ce que le manifeste dit :
 *   - #update-modal            mise à jour À CHAUD, appliquée par js/auto-updater.js,
 *                              puis "relancez Illustrator" ;
 *   - #update-installer-modal  la version exige l'INSTALLEUR (elle modifie des fichiers
 *                              que la mise à jour à chaud ne couvre pas : templates,
 *                              PSD…), ou le dossier de l'extension n'est pas modifiable.
 *
 * CURRENT_VERSION est bumpée par scripts/release.js — ne pas la déplacer.
 */

const UpdateChecker = {
    CURRENT_VERSION: '1.4.4',

    BASE_URL: 'https://logotyps.vercel.app',
    MANIFEST_URL: 'https://logotyps.vercel.app/api/updates/manifest',
    FILES_BASE_URL: 'https://logotyps.vercel.app/api/updates/files?file=',
    // Téléchargement direct de l'installeur (redirection 302 vers le fichier de la
    // dernière version) : l'utilisateur ne voit jamais GitHub.
    DOWNLOAD_URL: 'https://logotyps.vercel.app/api/download?platform=',
    UPDATE_PAGE_URL: 'https://logotyps.fr/download',

    SNOOZE_MS: 24 * 60 * 60 * 1000,
    // Au-delà, une mise à jour à chaud est considérée en échec (750 Ko à télécharger :
    // largement suffisant, même sur une connexion lente).
    APPLY_DEADLINE_MS: 10 * 60 * 1000,

    _manifest: null,
    // Action du bouton principal de la modale a chaud : change selon l'etat
    // (mettre a jour -> fermer / telecharger l'installeur). Un seul listener, pas de
    // onclick concurrent.
    _applyAction: null,

    // x.y.z ; segments manquants = 0, non numériques = 0. 1 / -1 / 0.
    compareVersions: function (v1, v2) {
        const a = String(v1 || '').split('.'), b = String(v2 || '').split('.');
        for (let i = 0; i < 3; i++) {
            const x = parseInt(a[i], 10) || 0, y = parseInt(b[i], 10) || 0;
            if (x > y) return 1;
            if (x < y) return -1;
        }
        return 0;
    },

    tr: function (key, fallback) {
        try { if (typeof t === 'function') { const s = t(key); if (s && s !== key) return s; } } catch (e) {}
        return fallback;
    },

    // ---- Manifeste -----------------------------------------------------------------

    fetchManifest: async function () {
        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, 5000);
        try {
            const res = await fetch(this.MANIFEST_URL, { headers: { 'Accept': 'application/json' }, signal: controller.signal, cache: 'no-store' });
            if (res.status === 404) return null;          // aucun manifeste publié encore
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const manifest = await res.json();
            if (!AutoUpdater.verifyManifestSignature(manifest)) {
                console.warn('⚠️ Manifeste de mise à jour rejeté : signature invalide');
                return null;
            }
            return manifest;
        } finally {
            clearTimeout(timer);
        }
    },

    // Version la plus haute déjà vue dans un manifeste valide : un serveur qui
    // resservirait un ancien manifeste (pourtant signé) ne peut pas faire reculer un
    // client qui a déjà vu plus récent. Protection partielle, mais gratuite.
    rememberSeen: function (version) {
        try {
            const seen = localStorage.getItem('update_max_seen');
            if (!seen || this.compareVersions(version, seen) > 0) localStorage.setItem('update_max_seen', version);
        } catch (e) {}
    },
    isOlderThanSeen: function (version) {
        try {
            const seen = localStorage.getItem('update_max_seen');
            return !!seen && this.compareVersions(version, seen) < 0;
        } catch (e) { return false; }
    },

    // 'hot' | 'installer' | null (à jour ou rien à proposer)
    decideMode: function (manifest) {
        if (!manifest || this.compareVersions(manifest.version, this.CURRENT_VERSION) <= 0) return null;
        if (this.isOlderThanSeen(manifest.version)) return null;
        if (manifest.hotUpdateFrom && this.compareVersions(this.CURRENT_VERSION, manifest.hotUpdateFrom) < 0) return 'installer';
        try {
            if (!AutoUpdater.isExtensionWritable(AutoUpdater.getExtensionPath())) return 'installer';
        } catch (e) {
            return 'installer';
        }
        return 'hot';
    },

    // "Plus tard" = 24 h de silence pour cette version, pas un enterrement définitif.
    isSnoozed: function (version) {
        try {
            const raw = localStorage.getItem('update_snooze');
            if (!raw) return false;
            const s = JSON.parse(raw);
            return s && s.version === version && typeof s.until === 'number' && Date.now() < s.until;
        } catch (e) { return false; }
    },
    snooze: function (version) {
        try { localStorage.setItem('update_snooze', JSON.stringify({ version: version, until: Date.now() + this.SNOOZE_MS })); } catch (e) {}
    },

    checkForUpdates: async function () {
        try {
            const manifest = await this.fetchManifest();
            if (!manifest) { console.log('✓ Aucun manifeste de mise à jour (version ' + this.CURRENT_VERSION + ')'); return null; }
            const mode = this.decideMode(manifest);
            if (!mode) { console.log('✓ Plugin à jour (version ' + this.CURRENT_VERSION + ')'); return null; }
            this.rememberSeen(manifest.version);
            if (this.isSnoozed(manifest.version)) { console.log('🔕 Mise à jour ' + manifest.version + ' reportée par l\'utilisateur'); return null; }
            console.log('🆕 Version ' + manifest.version + ' disponible (' + mode + '), actuelle ' + this.CURRENT_VERSION);
            return { manifest: manifest, mode: mode };
        } catch (e) {
            console.warn('⚠️ Vérification des mises à jour impossible :', e.message || e);
            return null;
        }
    },

    // ---- Modales ---------------------------------------------------------------------

    fillCommon: function (prefix, manifest) {
        const q = function (id) { return document.getElementById(id); };
        if (q(prefix + '-current-version')) q(prefix + '-current-version').textContent = this.CURRENT_VERSION;
        if (q(prefix + '-new-version')) q(prefix + '-new-version').textContent = manifest.version;
        if (q(prefix + '-release-date')) {
            let d = manifest.releaseDate || '';
            const locales = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' };
            const lang = (typeof I18N !== 'undefined' && I18N.currentLang) || 'fr';
            try { d = new Date(manifest.releaseDate).toLocaleDateString(locales[lang] || 'fr-FR'); } catch (e) {}
            q(prefix + '-release-date').textContent = d;
        }
        const list = q(prefix + '-changelog');
        if (list) {
            list.innerHTML = '';
            (manifest.changelog || []).forEach(function (line) {
                const li = document.createElement('li');
                li.textContent = line;
                list.appendChild(li);
            });
        }
    },

    showHotModal: function (manifest) {
        this._manifest = manifest;
        this.fillCommon('update', manifest);
        const body = document.getElementById('update-modal-body');
        if (body) body.hidden = false;
        const done = document.getElementById('update-done');
        if (done) done.hidden = true;
        const err = document.getElementById('update-error');
        if (err) { err.hidden = true; err.textContent = ''; }
        const apply = document.getElementById('update-apply-btn');
        if (apply) { apply.disabled = false; apply.textContent = this.tr('upd_apply', 'Télécharger et installer'); }
        const self = this;
        this._applyAction = function () { self.applyHotUpdate(); };
        const skip = document.getElementById('update-skip-btn');
        if (skip) { skip.disabled = false; skip.hidden = false; }
        const prog = document.getElementById('update-progress');
        if (prog) { prog.hidden = true; prog.textContent = ''; }
        document.getElementById('update-modal').style.display = 'flex';
    },

    showInstallerModal: function (manifest) {
        this._manifest = manifest;
        this.fillCommon('update-installer', manifest);
        document.getElementById('update-installer-modal').style.display = 'flex';
    },

    closeHotModal: function (snooze) {
        document.getElementById('update-modal').style.display = 'none';
        if (snooze && this._manifest) this.snooze(this._manifest.version);
    },

    closeInstallerModal: function (snooze) {
        document.getElementById('update-installer-modal').style.display = 'none';
        if (snooze && this._manifest) this.snooze(this._manifest.version);
    },

    // 'mac' | 'windows' d'après le navigateur du panneau (CEF).
    detectPlatform: function () {
        const s = ((navigator && (navigator.platform || '')) + ' ' + (navigator && (navigator.userAgent || ''))).toLowerCase();
        return /mac|darwin/.test(s) ? 'mac' : 'windows';
    },

    openInBrowser: function (url) {
        try {
            if (window.cep && window.cep.util) window.cep.util.openURLInDefaultBrowser(url);
            else window.open(url, '_blank');
        } catch (e) { window.open(url, '_blank'); }
    },

    // Lance le téléchargement de l'installeur pour cette plateforme dans le navigateur.
    openInstallerDownload: function () {
        this.openInBrowser(this.DOWNLOAD_URL + this.detectPlatform());
    },

    // ---- Application de la mise à jour à chaud -----------------------------------------

    applyHotUpdate: async function () {
        const manifest = this._manifest;
        if (!manifest) return;
        const apply = document.getElementById('update-apply-btn');
        const skip = document.getElementById('update-skip-btn');
        const closeX = document.getElementById('close-update-modal');
        const prog = document.getElementById('update-progress');
        const err = document.getElementById('update-error');
        const self = this;

        if (apply) apply.disabled = true;
        if (skip) skip.disabled = true;
        if (closeX) closeX.disabled = true;
        if (err) { err.hidden = true; err.textContent = ''; }
        if (prog) { prog.hidden = false; prog.textContent = this.tr('upd_progress_start', 'Préparation…'); }

        let result;
        let deadline = null;
        try {
            const work = AutoUpdater.applyUpdate(manifest, {
                filesBaseUrl: this.FILES_BASE_URL,
                onProgress: function (step, current, total, file) {
                    if (!prog) return;
                    prog.textContent = (step === 'download'
                        ? self.tr('upd_progress_download', 'Téléchargement')
                        : self.tr('upd_progress_install', 'Installation')) + ' ' + current + '/' + total + ' — ' + file;
                }
            });
            // Garde-fou : quoi qu'il arrive au réseau, la modale rend la main.
            const timeout = new Promise(function (resolve) {
                deadline = setTimeout(function () { resolve({ success: false, error: 'délai dépassé' }); }, self.APPLY_DEADLINE_MS);
            });
            result = await Promise.race([work, timeout]);
        } catch (e) {
            result = { success: false, error: (e && e.message) || String(e) };
        } finally {
            if (deadline) clearTimeout(deadline);
        }

        if (closeX) closeX.disabled = false;

        if (result.success) {
            // Ne plus rien proposer : les fichiers sont ceux de la nouvelle version, seule
            // la session Illustrator en cours a encore l'ancien hostscript.jsx en mémoire.
            try { localStorage.setItem('update_applied', manifest.version); localStorage.removeItem('update_snooze'); } catch (e) {}
            const body = document.getElementById('update-modal-body');
            const done = document.getElementById('update-done');
            if (body) body.hidden = true;
            if (done) done.hidden = false;
            if (skip) skip.hidden = true;
            if (apply) { apply.disabled = false; apply.textContent = this.tr('upd_close', 'Fermer'); }
            this._applyAction = function () { self.closeHotModal(false); };
            if (typeof window !== 'undefined' && window.__logopackOnHotUpdateApplied) {
                try { window.__logopackOnHotUpdateApplied(manifest.version); } catch (e) {}
            }
        } else {
            console.error('❌ Mise à jour à chaud échouée :', result.error);
            if (prog) prog.hidden = true;
            if (err) {
                err.hidden = false;
                err.textContent = this.tr('upd_error_prefix', 'La mise à jour n\'a pas pu être appliquée : ') + (result.error || '?')
                    + ' ' + this.tr('upd_error_fallback', 'Vous pouvez télécharger l\'installeur à la place.');
            }
            if (skip) skip.disabled = false;
            if (apply) {
                apply.disabled = false;
                apply.textContent = this.tr('upd_installer_download', 'Télécharger l\'installeur');
            }
            this._applyAction = function () { self.openInstallerDownload(); self.closeHotModal(false); };
        }
    },

    // ---- Câblage --------------------------------------------------------------------------

    bindModals: function () {
        const self = this;
        const on = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        on('update-apply-btn', function () { if (self._applyAction) self._applyAction(); });
        on('update-skip-btn', function () { self.closeHotModal(true); });
        on('close-update-modal', function () { self.closeHotModal(true); });
        on('update-installer-download-btn', function () { self.openInstallerDownload(); self.closeInstallerModal(false); });
        on('update-installer-skip-btn', function () { self.closeInstallerModal(true); });
        on('close-update-installer-modal', function () { self.closeInstallerModal(true); });
        ['update-modal', 'update-installer-modal'].forEach(function (id) {
            const m = document.getElementById(id);
            if (m) m.addEventListener('click', function (e) {
                if (e.target !== m) return;
                if (id === 'update-modal') { const c = document.getElementById('close-update-modal'); if (c && c.disabled) return; self.closeHotModal(true); }
                else self.closeInstallerModal(true);
            });
        });
    },

    init: function () {
        this.bindModals();
        const self = this;
        setTimeout(async function () {
            // Une mise à jour à chaud a déjà été appliquée et Illustrator n'a pas encore été
            // relancé : ne pas la reproposer.
            try {
                const applied = localStorage.getItem('update_applied');
                if (applied && self.compareVersions(applied, self.CURRENT_VERSION) > 0) return;
                if (applied) localStorage.removeItem('update_applied');
            } catch (e) {}
            const found = await self.checkForUpdates();
            if (!found) return;
            if (found.mode === 'hot') self.showHotModal(found.manifest);
            else self.showInstallerModal(found.manifest);
        }, 2000);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { UpdateChecker.init(); });
} else {
    UpdateChecker.init();
}
