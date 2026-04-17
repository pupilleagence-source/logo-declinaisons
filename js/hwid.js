/**
 * Hardware ID Generator pour CEP Extensions
 * Génère un identifiant unique et STABLE basé sur la machine
 *
 * Utilise Node.js (disponible dans CEP) pour des identifiants fiables
 * qui ne changent PAS lors d'une mise à jour d'Illustrator.
 *
 * Composants stables utilisés :
 *   - hostname (nom de la machine)
 *   - username (vrai nom d'utilisateur OS)
 *   - MAC address (première interface réseau non-interne)
 *   - OS type + arch (ex: Windows_NT x64)
 *   - CPU model (ex: Intel Core i7-10700K)
 *
 * Persistance : fichier disque + localStorage (survit aux MAJ CEP)
 */

const HWID = {
    // Version du schéma de fingerprint (incrémenter si on change les composants)
    SCHEMA_VERSION: 2,

    /**
     * Génère un hash SHA-256 via Node.js crypto (plus fiable que le navigateur)
     */
    hash: function(text) {
        try {
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(text).digest('hex');
        } catch (e) {
            // Fallback navigateur
            return this.browserHash(text);
        }
    },

    /**
     * Fallback hash si Node.js crypto non disponible
     */
    browserHash: function(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    },

    /**
     * Collecte les informations machine STABLES via Node.js
     */
    collectStableInfo: function() {
        const os = require('os');

        // MAC address : première interface non-interne, non-loopback
        let macAddress = '';
        try {
            const interfaces = os.networkInterfaces();
            const ifNames = Object.keys(interfaces).sort(); // tri alphabétique pour déterminisme
            for (let i = 0; i < ifNames.length && !macAddress; i++) {
                const iface = interfaces[ifNames[i]];
                for (let j = 0; j < iface.length; j++) {
                    if (!iface[j].internal && iface[j].mac && iface[j].mac !== '00:00:00:00:00:00') {
                        macAddress = iface[j].mac;
                        break;
                    }
                }
            }
        } catch (e) {}

        // CPU model (premier core)
        let cpuModel = '';
        try {
            const cpus = os.cpus();
            if (cpus && cpus.length > 0) {
                cpuModel = cpus[0].model || '';
            }
        } catch (e) {}

        return {
            hostname: os.hostname() || '',
            username: os.userInfo().username || '',
            macAddress: macAddress,
            osType: os.type() || '',       // Windows_NT, Darwin, Linux
            osArch: os.arch() || '',       // x64, arm64
            cpuModel: cpuModel,
            cpuCores: os.cpus().length || 0
        };
    },

    /**
     * Génère le Hardware ID unique et stable
     */
    generate: function() {
        try {
            const info = this.collectStableInfo();

            // Composants du fingerprint (tous stables entre mises à jour)
            const fingerprint = [
                'v' + this.SCHEMA_VERSION,
                info.hostname,
                info.username,
                info.macAddress,
                info.osType,
                info.osArch,
                info.cpuModel,
                info.cpuCores
            ].join('|');

            const hashed = this.hash(fingerprint);
            const hwid = 'HWID-' + hashed;

            console.log('✓ HWID v' + this.SCHEMA_VERSION + ' généré:', hwid.substring(0, 20) + '...');
            return hwid;

        } catch (error) {
            console.error('❌ Erreur génération HWID:', error);
            // Fallback : ID aléatoire persisté
            const fallbackId = 'HWID-FALLBACK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            return fallbackId;
        }
    },

    /**
     * Chemin du fichier de persistance sur disque
     * Stocké dans le dossier utilisateur (survit aux MAJ Illustrator + CEP)
     */
    getPersistPath: function() {
        const os = require('os');
        const path = require('path');
        // ~/.logotyps-hwid (caché sur Unix, normal sur Windows dans le home)
        return path.join(os.homedir(), '.logotyps-hwid');
    },

    /**
     * Lit le HWID persisté sur disque
     */
    readFromDisk: function() {
        try {
            const fs = require('fs');
            const filePath = this.getPersistPath();
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8').trim();
                if (content && content.startsWith('HWID-')) {
                    return content;
                }
            }
        } catch (e) {
            console.warn('⚠️ Impossible de lire HWID depuis disque:', e.message);
        }
        return null;
    },

    /**
     * Ecrit le HWID sur disque
     */
    writeToDisk: function(hwid) {
        try {
            const fs = require('fs');
            fs.writeFileSync(this.getPersistPath(), hwid, 'utf8');
        } catch (e) {
            console.warn('⚠️ Impossible d\'écrire HWID sur disque:', e.message);
        }
    },

    /**
     * Récupère ou génère le HWID
     * Priorité : disque > localStorage > générer
     *
     * NOTE: Retourne maintenant de manière synchrone (pas de async/await nécessaire)
     * mais on garde la compatibilité avec les appelants async
     */
    get: async function() {
        // 1. Vérifier le fichier disque (survit aux MAJ Illustrator)
        const fromDisk = this.readFromDisk();
        if (fromDisk) {
            // Synchroniser avec localStorage aussi
            localStorage.setItem('_hwid', fromDisk);
            return fromDisk;
        }

        // 2. Vérifier localStorage (même version d'Illustrator)
        const cached = localStorage.getItem('_hwid');
        if (cached && cached.startsWith('HWID-')) {
            // Persister sur disque pour les prochaines MAJ
            this.writeToDisk(cached);
            return cached;
        }

        // 3. Générer un nouveau HWID
        const hwid = this.generate();

        // Persister partout
        localStorage.setItem('_hwid', hwid);
        this.writeToDisk(hwid);

        return hwid;
    },

    /**
     * Debug: affiche les informations système stables
     */
    debug: function() {
        const info = this.collectStableInfo();
        console.log('=== Stable Machine Fingerprint (v' + this.SCHEMA_VERSION + ') ===');
        console.table(info);
        console.log('Persist path:', this.getPersistPath());
        console.log('Disk HWID:', this.readFromDisk());
        console.log('localStorage HWID:', localStorage.getItem('_hwid'));
    }
};

// Export pour utilisation
window.HWID = HWID;
