/**
 * Système de vérification et notification de mises à jour
 */

const UpdateChecker = {
    // Version actuelle du plugin (doit correspondre au manifest.xml)
    CURRENT_VERSION: '1.0.0',

    // URL de l'API de versionning
    API_URL: 'https://logotyps.vercel.app/api/version/latest',

    /**
     * Compare deux versions (format: x.y.z)
     * @returns 1 si v1 > v2, -1 si v1 < v2, 0 si égales
     */
    compareVersions: function(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (parts1[i] > parts2[i]) return 1;
            if (parts1[i] < parts2[i]) return -1;
        }
        return 0;
    },

    /**
     * Vérifie s'il y a une nouvelle version disponible
     */
    checkForUpdates: async function() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(this.API_URL, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn('⚠️ Impossible de vérifier les mises à jour');
                return null;
            }

            const data = await response.json();

            // Comparer les versions
            const comparison = this.compareVersions(data.version, this.CURRENT_VERSION);

            if (comparison > 0) {
                // Nouvelle version disponible
                console.log(`🆕 Nouvelle version disponible: ${data.version} (actuelle: ${this.CURRENT_VERSION})`);
                return data;
            } else {
                console.log(`✓ Plugin à jour (version ${this.CURRENT_VERSION})`);
                return null;
            }

        } catch (error) {
            console.warn('⚠️ Erreur lors de la vérification des mises à jour:', error.message);
            return null;
        }
    },

    /**
     * Affiche la modal de mise à jour
     */
    showUpdateModal: function(updateInfo) {
        const modal = document.getElementById('update-modal');

        // Remplir les informations
        document.getElementById('update-current-version').textContent = this.CURRENT_VERSION;
        document.getElementById('update-new-version').textContent = updateInfo.version;
        document.getElementById('update-release-date').textContent = new Date(updateInfo.releaseDate).toLocaleDateString('fr-FR');

        // Remplir le changelog
        const changelogList = document.getElementById('update-changelog');
        changelogList.innerHTML = '';
        updateInfo.changelog.forEach(change => {
            const li = document.createElement('li');
            li.textContent = change;
            changelogList.appendChild(li);
        });

        // Stocker l'URL de téléchargement
        document.getElementById('update-download-btn').dataset.downloadUrl = updateInfo.downloadUrl;

        // Afficher la modal
        modal.style.display = 'flex';
    },

    /**
     * Ferme la modal de mise à jour
     */
    closeUpdateModal: function() {
        document.getElementById('update-modal').style.display = 'none';

        // Sauvegarder qu'on a ignoré cette version (pour ne pas redemander pendant cette session)
        sessionStorage.setItem('ignored_update', 'true');
    },

    /**
     * Télécharge la mise à jour
     */
    downloadUpdate: function(downloadUrl) {
        // Ouvrir le lien de téléchargement dans le navigateur
        window.open(downloadUrl, '_blank');

        // Fermer la modal
        this.closeUpdateModal();
    },

    /**
     * Initialise la vérification des mises à jour
     * Appeler au démarrage du plugin
     */
    init: async function() {
        // Ne pas vérifier si on a déjà ignoré pendant cette session
        if (sessionStorage.getItem('ignored_update') === 'true') {
            return;
        }

        // Attendre 2 secondes après le chargement pour ne pas bloquer le démarrage
        setTimeout(async () => {
            const updateInfo = await this.checkForUpdates();

            if (updateInfo) {
                this.showUpdateModal(updateInfo);
            }
        }, 2000);
    }
};

// Au chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        UpdateChecker.init();
    });
} else {
    UpdateChecker.init();
}
