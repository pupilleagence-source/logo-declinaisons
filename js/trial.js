/**
 * Trial System - Compteur 7 générations gratuites
 * Validation serveur + cache local avec grace period (7 jours)
 */

const Trial = {
    // Configuration
    config: {
        freeGenerations: 7,
        gracePeriodDays: 7,
        serverURL: 'https://logotyps-mprhphe6s-pupilleagence-sources-projects.vercel.app/api/trial',
    },

    /**
     * Initialise le système de trial
     */
    init: async function() {
        try {
            console.log('🎁 Initialisation du système de trial...');

            // Récupérer le HWID
            const hwid = await HWID.get();
            console.log('✓ HWID récupéré');

            // Vérifier le statut
            const status = await this.getStatus();

            console.log('✓ Statut trial:', status);
            return status;

        } catch (error) {
            console.error('❌ Erreur init trial:', error);
            return this.getDefaultStatus();
        }
    },

    /**
     * Récupère le statut actuel (trial ou license)
     */
    getStatus: async function() {
        // 1. Vérifier si license activée
        const license = this.getStoredLicense();
        if (license && license.active) {
            return {
                type: 'licensed',
                unlimitedGenerations: true,
                licenseKey: license.key,
                email: license.email
            };
        }

        // 2. Récupérer cache local
        const cached = this.getCachedStatus();

        // 3. Vérifier si cache valide (pas expiré)
        if (cached && !this.isCacheExpired(cached)) {
            console.log('✓ Utilisation du cache local (valide)');
            return {
                type: 'trial',
                generationsUsed: cached.generationsUsed,
                generationsRemaining: this.config.freeGenerations - cached.generationsUsed,
                generationsLimit: this.config.freeGenerations,
                cacheExpiry: cached.expiry
            };
        }

        // 4. Cache expiré ou inexistant → Valider avec serveur
        console.log('⏳ Validation avec serveur...');
        try {
            const serverStatus = await this.validateWithServer();
            this.cacheStatus(serverStatus);
            return serverStatus;
        } catch (error) {
            console.warn('⚠️ Serveur inaccessible, utilisation cache expiré', error);

            // Fallback: utiliser cache même expiré si pas le choix
            if (cached) {
                return {
                    type: 'trial',
                    generationsUsed: cached.generationsUsed,
                    generationsRemaining: this.config.freeGenerations - cached.generationsUsed,
                    generationsLimit: this.config.freeGenerations,
                    offline: true
                };
            }

            // Pas de cache du tout → Donner un statut par défaut
            return this.getDefaultStatus();
        }
    },

    /**
     * Statut par défaut (première utilisation)
     */
    getDefaultStatus: function() {
        return {
            type: 'trial',
            generationsUsed: 0,
            generationsRemaining: this.config.freeGenerations,
            generationsLimit: this.config.freeGenerations
        };
    },

    /**
     * Valide avec le serveur
     */
    validateWithServer: async function() {
        const hwid = await HWID.get();

        const response = await fetch(this.config.serverURL + '/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hwid })
        });

        if (!response.ok) {
            throw new Error('Serveur inaccessible');
        }

        const data = await response.json();

        return {
            type: 'trial',
            generationsUsed: data.generationsUsed || 0,
            generationsRemaining: this.config.freeGenerations - (data.generationsUsed || 0),
            generationsLimit: this.config.freeGenerations
        };
    },

    /**
     * Vérifie si une génération est autorisée
     */
    canGenerate: async function() {
        const status = await this.getStatus();

        // License activée → illimité
        if (status.type === 'licensed') {
            return { allowed: true, reason: 'licensed' };
        }

        // Trial → vérifier limite
        if (status.generationsRemaining > 0) {
            return { allowed: true, reason: 'trial', remaining: status.generationsRemaining };
        }

        // Trial épuisé
        return {
            allowed: false,
            reason: 'trial_expired',
            message: 'Vos 7 générations gratuites sont épuisées. Activez une license pour continuer.'
        };
    },

    /**
     * Incrémente le compteur de générations
     */
    incrementGeneration: async function() {
        try {
            const hwid = await HWID.get();

            // Incrémenter sur le serveur
            const response = await fetch(this.config.serverURL + '/increment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ hwid })
            });

            if (response.ok) {
                const data = await response.json();

                // Mettre à jour le cache local
                this.cacheStatus({
                    generationsUsed: data.generationsUsed
                });

                console.log('✓ Génération comptabilisée:', data.generationsUsed + '/' + this.config.freeGenerations);
                return data.generationsUsed;
            } else {
                // Serveur a répondu mais erreur → fallback local
                throw new Error('Serveur non disponible');
            }

        } catch (error) {
            console.warn('⚠️ Impossible d\'incrémenter sur serveur (offline), utilisation du cache local', error);

            // Fallback: incrémenter localement
            const cached = this.getCachedStatus() || { generationsUsed: 0 };
            cached.generationsUsed++;
            this.cacheStatus(cached);

            console.log('✓ Génération comptabilisée localement:', cached.generationsUsed + '/' + this.config.freeGenerations);
            return cached.generationsUsed;
        }
    },

    /**
     * Cache le statut localement (avec expiration)
     */
    cacheStatus: function(status) {
        const expiry = Date.now() + (this.config.gracePeriodDays * 24 * 60 * 60 * 1000);

        const cache = {
            generationsUsed: status.generationsUsed || 0,
            expiry: expiry,
            timestamp: Date.now()
        };

        // Chiffrement basique (encode + obfuscation)
        const encoded = btoa(JSON.stringify(cache));
        localStorage.setItem('_trial_cache', encoded);
    },

    /**
     * Récupère le cache local
     */
    getCachedStatus: function() {
        try {
            const encoded = localStorage.getItem('_trial_cache');
            if (!encoded) return null;

            const decoded = atob(encoded);
            return JSON.parse(decoded);
        } catch (error) {
            console.error('❌ Erreur lecture cache:', error);
            return null;
        }
    },

    /**
     * Vérifie si le cache est expiré
     */
    isCacheExpired: function(cache) {
        return cache.expiry < Date.now();
    },

    /**
     * Récupère la license stockée (si activée)
     */
    getStoredLicense: function() {
        try {
            const encoded = localStorage.getItem('_license');
            if (!encoded) return null;

            const decoded = atob(encoded);
            return JSON.parse(decoded);
        } catch (error) {
            return null;
        }
    },

    /**
     * Stocke une license activée
     */
    storeLicense: function(licenseData) {
        const encoded = btoa(JSON.stringify(licenseData));
        localStorage.setItem('_license', encoded);
    },

    /**
     * Réinitialise le trial (DEBUG ONLY - à retirer en production)
     */
    reset: function() {
        localStorage.removeItem('_trial_cache');
        localStorage.removeItem('_license');
        console.log('✓ Trial réinitialisé (DEBUG)');
    }
};

// Export
window.Trial = Trial;
