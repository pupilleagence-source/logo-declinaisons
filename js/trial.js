/**
 * Trial System - Compteur 7 générations gratuites
 * Validation serveur + cache local avec grace period (7 jours)
 */

const Trial = {
    // Configuration
    config: {
        freeGenerations: 7,
        gracePeriodDays: 7,
        serverURL: 'https://logotyps.vercel.app/api/trial',
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
            // Pour les licences : utiliser le cache avec grace period (mode offline OK)
            const cached = this.getCachedStatus();

            if (cached && !this.isCacheExpired(cached)) {
                console.log('✓ License active (cache local)');
                return {
                    type: 'licensed',
                    unlimitedGenerations: true,
                    licenseKey: license.key,
                    email: license.email,
                    offline: false
                };
            }

            // Essayer de valider avec le serveur
            try {
                const hwid = await HWID.get();

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch('https://logotyps.vercel.app/api/license/validate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ hwid }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();

                    if (data.valid) {
                        // Licence valide, mettre à jour le cache
                        this.saveCachedStatus({
                            type: 'licensed',
                            unlimitedGenerations: true,
                            expiry: Date.now() + (24 * 60 * 60 * 1000) // 24h
                        });

                        console.log('✓ License active (validée serveur)');
                        return {
                            type: 'licensed',
                            unlimitedGenerations: true,
                            licenseKey: license.key,
                            email: license.email
                        };
                    } else {
                        // Licence révoquée ou expirée
                        console.warn('⚠️ Licence révoquée:', data.message);
                        localStorage.removeItem('_license');
                        localStorage.removeItem('_trial_cache');

                        // Basculer en mode trial
                        const trialStatus = await this.validateWithServer();
                        return trialStatus;
                    }
                } else {
                    throw new Error('Erreur validation serveur');
                }
            } catch (error) {
                // Mode offline pour les licences payées (grace period de 7 jours)
                const licenseAge = Date.now() - (license.activatedAt || 0);
                const maxOfflineAge = 7 * 24 * 60 * 60 * 1000; // 7 jours

                if (licenseAge < maxOfflineAge) {
                    console.log('⚠️ Serveur inaccessible, utilisation license en mode offline');
                    return {
                        type: 'licensed',
                        unlimitedGenerations: true,
                        licenseKey: license.key,
                        email: license.email,
                        offline: true
                    };
                } else {
                    // Grace period expiré : supprimer la licence fantôme et basculer en trial
                    console.warn('⚠️ Licence offline depuis trop longtemps (>7 jours), bascule en mode trial');
                    localStorage.removeItem('_license');
                    localStorage.removeItem('_trial_cache');

                    // Tenter le mode trial
                    try {
                        const trialStatus = await this.validateWithServer();
                        return trialStatus;
                    } catch (trialError) {
                        console.error('❌ Serveur inaccessible pour le trial aussi', trialError);
                        return {
                            type: 'trial',
                            error: true,
                            offline: true,
                            message: 'Connexion Internet requise pour utiliser le trial gratuit.\n\nActivez une license pour un accès offline illimité.'
                        };
                    }
                }
            }
        }

        // 2. TRIAL : Toujours valider avec le serveur (pas de cache local)
        console.log('⏳ Validation trial avec serveur...');
        try {
            const serverStatus = await this.validateWithServer();
            return serverStatus;
        } catch (error) {
            console.error('❌ Serveur inaccessible pour le trial', error);

            // Pour le trial : pas de fallback offline
            // On retourne un statut d'erreur qui bloquera l'utilisation
            return {
                type: 'trial',
                error: true,
                offline: true,
                message: 'Connexion Internet requise pour utiliser le trial gratuit.\n\nActivez une license pour un accès offline illimité.'
            };
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

        // Créer un AbortController pour timeout de 5 secondes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(this.config.serverURL + '/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ hwid }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

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
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('Timeout: serveur inaccessible (5s)');
            }
            throw error;
        }
    },

    /**
     * Vérifie si une génération est autorisée
     * IMPORTANT: Pour les licences payées, valide en temps réel avec le serveur
     */
    canGenerate: async function() {
        // Vérifier si l'utilisateur a une license
        const license = this.getStoredLicense();

        if (license && license.active) {
            // FORCE validation serveur avant chaque génération (pas de cache)
            try {
                const hwid = await HWID.get();

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch('https://logotyps.vercel.app/api/license/validate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ hwid }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();

                    if (data.valid) {
                        // Licence valide
                        console.log('✓ License valide (vérification temps réel)');
                        return { allowed: true, reason: 'licensed' };
                    } else {
                        // Licence révoquée → Désactiver sur Lemon Squeezy pour libérer le slot
                        console.warn('⚠️ Licence révoquée:', data.message);

                        // Libérer le slot Lemon Squeezy
                        try {
                            await this.forceLicenseDeactivate();
                            console.log('✓ Slot Lemon Squeezy libéré');
                        } catch (deactivateError) {
                            console.warn('⚠️ Impossible de libérer le slot:', deactivateError);
                        }

                        return {
                            allowed: false,
                            reason: 'license_revoked',
                            message: 'Votre licence a été révoquée.\n\nVeuillez contacter le support.',
                            needsUIUpdate: true // Signal pour mettre à jour l'interface
                        };
                    }
                } else {
                    throw new Error('Erreur validation serveur');
                }
            } catch (error) {
                // Mode offline pour les licences payées (grace period de 7 jours)
                const licenseAge = Date.now() - (license.activatedAt || 0);
                const maxOfflineAge = 7 * 24 * 60 * 60 * 1000; // 7 jours

                if (licenseAge < maxOfflineAge) {
                    console.log('⚠️ Serveur inaccessible, utilisation license en mode offline');
                    return {
                        allowed: true,
                        reason: 'licensed',
                        offline: true
                    };
                } else {
                    console.error('❌ Licence offline depuis trop longtemps (>7 jours)');
                    return {
                        allowed: false,
                        reason: 'license_offline',
                        message: 'Connexion Internet requise pour valider votre licence.\n\n(Offline depuis plus de 7 jours)'
                    };
                }
            }
        }

        // TRIAL : Vérifier le statut
        const status = await this.getStatus();

        // Trial en erreur (serveur inaccessible)
        if (status.error) {
            return {
                allowed: false,
                reason: 'trial_offline',
                message: status.message
            };
        }

        // Trial → vérifier limite
        if (status.generationsRemaining > 0) {
            return { allowed: true, reason: 'trial', remaining: status.generationsRemaining };
        }

        // Trial épuisé
        return {
            allowed: false,
            reason: 'trial_expired',
            message: 'Vos 7 générations gratuites sont épuisées.\n\nActivez une license pour un accès illimité et offline.'
        };
    },

    /**
     * Incrémente le compteur de générations
     */
    incrementGeneration: async function() {
        // Vérifier si l'utilisateur a une license
        const license = this.getStoredLicense();

        // Si license active : pas besoin d'incrémenter (accès illimité)
        if (license && license.active) {
            console.log('✓ License active : génération illimitée');
            return 0; // Valeur fictive, pas de limite
        }

        // TRIAL : Toujours incrémenter sur le serveur (pas de fallback local)
        try {
            const hwid = await HWID.get();

            // Créer un AbortController pour timeout de 5 secondes
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                // Incrémenter sur le serveur
                const response = await fetch(this.config.serverURL + '/increment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ hwid }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    console.log('✓ Génération comptabilisée:', data.generationsUsed + '/' + this.config.freeGenerations);
                    return data.generationsUsed;
                } else {
                    // Erreur serveur
                    throw new Error('Serveur inaccessible');
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);

                if (fetchError.name === 'AbortError') {
                    throw new Error('Timeout: impossible de joindre le serveur');
                }
                throw fetchError;
            }

        } catch (error) {
            console.error('❌ Impossible d\'incrémenter sur serveur (trial nécessite connexion)', error);

            // Pour le trial : pas de fallback offline
            // On lance une erreur qui sera gérée par l'appelant
            throw new Error('Connexion Internet requise pour le trial gratuit');
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
    reset: async function() {
        try {
            // Récupérer le HWID actuel avant de le supprimer
            const hwid = await HWID.get();

            // Supprimer les données locales
            localStorage.removeItem('_trial_cache');
            localStorage.removeItem('_license');
            localStorage.removeItem('_hwid');

            // Appeler le serveur pour supprimer la clé Redis
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(this.config.serverURL + '/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ hwid }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    console.log('✓ Trial réinitialisé (local + serveur):', data);
                } else {
                    console.warn('⚠️ Trial réinitialisé localement, mais erreur serveur');
                }
            } catch (error) {
                console.warn('⚠️ Trial réinitialisé localement, serveur inaccessible:', error.message);
            }

        } catch (error) {
            console.error('❌ Erreur reset trial:', error);
            // Quand même supprimer les données locales
            localStorage.removeItem('_trial_cache');
            localStorage.removeItem('_license');
            localStorage.removeItem('_hwid');
        }
    },

    /**
     * Force la désactivation d'une licence (sans passer par Lemon Squeezy)
     * Utilisé quand l'instance_id n'est pas disponible
     */
    forceLicenseDeactivate: async function() {
        try {
            const hwid = await HWID.get();

            // Supprimer localement d'abord
            localStorage.removeItem('_license');

            // Appeler le serveur pour supprimer de Redis
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch('https://logotyps.vercel.app/api/license/force-deactivate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ hwid }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    console.log('✓ Licence désactivée (force):', data);
                    return { success: true, message: 'Licence désactivée avec succès' };
                } else {
                    const error = await response.json();
                    console.warn('⚠️ Erreur désactivation serveur:', error);
                    return { success: false, message: error.message };
                }
            } catch (error) {
                console.warn('⚠️ Licence supprimée localement, serveur inaccessible:', error.message);
                return { success: true, message: 'Licence supprimée localement' };
            }

        } catch (error) {
            console.error('❌ Erreur force deactivate:', error);
            return { success: false, message: error.message };
        }
    }
};

// Export
window.Trial = Trial;
