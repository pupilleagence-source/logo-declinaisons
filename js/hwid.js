/**
 * Hardware ID Generator pour CEP Extensions
 * Génère un identifiant unique basé sur les caractéristiques de la machine
 */

const HWID = {
    /**
     * Génère un hash SHA-256 simple (pour CEP sans crypto.subtle)
     */
    simpleHash: async function(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        // Utiliser crypto.subtle si disponible
        if (window.crypto && window.crypto.subtle) {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Fallback: hash simple basé sur string
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    },

    /**
     * Collecte les informations système
     */
    collectSystemInfo: function() {
        const info = {
            // Informations navigateur
            userAgent: navigator.userAgent || '',
            platform: navigator.platform || '',
            language: navigator.language || '',

            // Informations écran
            screenWidth: screen.width || 0,
            screenHeight: screen.height || 0,
            screenDepth: screen.colorDepth || 0,

            // Informations timezone
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            timezoneOffset: new Date().getTimezoneOffset() || 0,

            // Informations hardware
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            deviceMemory: navigator.deviceMemory || 0,

            // CEP spécifique - nom utilisateur (via système)
            username: this.getUsername(),
        };

        return info;
    },

    /**
     * Récupère le nom d'utilisateur système si possible
     */
    getUsername: function() {
        try {
            // Tenter de récupérer via ExtendScript
            const csInterface = new CSInterface();
            const os = csInterface.getOSInformation();

            // Le nom d'utilisateur n'est pas directement accessible
            // On utilise une approche basée sur l'OS
            if (os.indexOf('Windows') !== -1) {
                return 'win-user'; // Placeholder
            } else if (os.indexOf('Mac') !== -1) {
                return 'mac-user'; // Placeholder
            }
        } catch (e) {
            console.log('Impossible de récupérer username:', e);
        }
        return 'unknown';
    },

    /**
     * Génère le Hardware ID unique
     */
    generate: async function() {
        try {
            const info = this.collectSystemInfo();

            // Créer une chaîne unique à partir de toutes les infos
            const fingerprint = [
                info.userAgent,
                info.platform,
                info.language,
                info.screenWidth + 'x' + info.screenHeight,
                info.screenDepth,
                info.timezone,
                info.timezoneOffset,
                info.hardwareConcurrency,
                info.deviceMemory,
                info.username
            ].join('|');

            // Hasher le fingerprint
            const hash = await this.simpleHash(fingerprint);

            // Ajouter un préfixe pour identification
            const hwid = 'HWID-' + hash;

            console.log('✓ Hardware ID généré:', hwid.substring(0, 20) + '...');
            return hwid;

        } catch (error) {
            console.error('❌ Erreur génération HWID:', error);

            // Fallback: générer un ID aléatoire et le persister
            const fallbackId = 'HWID-FALLBACK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            return fallbackId;
        }
    },

    /**
     * Récupère ou génère le HWID et le met en cache
     */
    get: async function() {
        // Vérifier si déjà en cache
        const cached = localStorage.getItem('_hwid');
        if (cached) {
            return cached;
        }

        // Générer et mettre en cache
        const hwid = await this.generate();
        localStorage.setItem('_hwid', hwid);

        return hwid;
    },

    /**
     * Debug: affiche les informations système
     */
    debug: function() {
        const info = this.collectSystemInfo();
        console.log('=== System Fingerprint ===');
        console.table(info);
    }
};

// Export pour utilisation
window.HWID = HWID;
