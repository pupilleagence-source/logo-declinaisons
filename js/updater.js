/**
 * Système de vérification et notification de mises à jour
 */

const UpdateChecker = {
    // Version actuelle du plugin (doit correspondre au manifest.xml)
    CURRENT_VERSION: '1.1.0',

    // URL de l'API de versionning
    API_URL: 'https://logotyps.vercel.app/api/version/latest',

    // URL de l'API de mise à jour
    UPDATES_API_URL: 'https://logotyps.vercel.app/api/updates',

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
                // Vérifier si cette version a déjà été ignorée
                try {
                    var ignoredVersion = localStorage.getItem('ignored_update_version');
                    if (ignoredVersion === data.version) {
                        console.log(`🔕 Version ${data.version} déjà ignorée par l'utilisateur`);
                        return null;
                    }
                } catch (e) {}

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

        // Sauvegarder la version ignorée (persistant : ne redemande plus pour cette version)
        try {
            var newVer = document.getElementById('update-new-version');
            if (newVer && newVer.textContent && newVer.textContent !== '-') {
                localStorage.setItem('ignored_update_version', newVer.textContent.trim());
            }
        } catch (e) {}
    },

    /**
     * Installe la mise à jour automatiquement
     */
    installUpdate: async function() {
        const modal = document.getElementById('update-modal');
        const downloadBtn = document.getElementById('update-download-btn');
        const skipBtn = document.getElementById('update-skip-btn');
        const modalBody = modal.querySelector('.modal-body');

        try {
            // Désactiver les boutons
            downloadBtn.disabled = true;
            skipBtn.disabled = true;
            downloadBtn.textContent = 'Installation en cours...';

            // Afficher la progression
            const progressDiv = document.createElement('div');
            progressDiv.id = 'update-progress';
            progressDiv.style.marginTop = '20px';
            progressDiv.style.padding = '15px';
            progressDiv.style.background = '#f0f0f0';
            progressDiv.style.borderRadius = '8px';
            progressDiv.innerHTML = '<strong>Installation...</strong><br><span id="progress-text">Téléchargement du manifest...</span>';
            modalBody.appendChild(progressDiv);

            const progressText = document.getElementById('progress-text');

            // Télécharger le manifest de mise à jour
            const manifestResponse = await fetch(`${this.UPDATES_API_URL}/manifest`);
            if (!manifestResponse.ok) {
                throw new Error('Impossible de récupérer le manifest de mise à jour');
            }

            const manifest = await manifestResponse.json();

            // Effectuer la mise à jour avec AutoUpdater
            const result = await AutoUpdater.performUpdate(manifest, (file, current, total) => {
                progressText.textContent = `Mise à jour (${current}/${total}): ${file}`;
            });

            if (result.success) {
                // Succès !
                progressDiv.innerHTML = `
                    <strong style="color: #4CAF50;">✅ Mise à jour installée avec succès !</strong><br><br>
                    <p>${result.filesUpdated.length} fichier(s) mis à jour.</p>
                    <p style="color: #ff9800;"><strong>⚠️ Veuillez fermer et rouvrir Illustrator pour appliquer les changements.</strong></p>
                `;

                // Changer le bouton
                downloadBtn.textContent = 'Fermer';
                downloadBtn.disabled = false;
                downloadBtn.onclick = () => {
                    modal.style.display = 'none';
                };

                // Masquer le bouton "Plus tard"
                skipBtn.style.display = 'none';

            } else {
                // Échec
                throw new Error('La mise à jour a échoué');
            }

        } catch (error) {
            console.error('❌ Erreur d\'installation:', error);

            // Afficher l'erreur
            const errorDiv = document.createElement('div');
            errorDiv.style.marginTop = '15px';
            errorDiv.style.padding = '10px';
            errorDiv.style.background = '#ffebee';
            errorDiv.style.border = '1px solid #f44336';
            errorDiv.style.borderRadius = '6px';
            errorDiv.style.color = '#c62828';
            errorDiv.innerHTML = `<strong>❌ Erreur :</strong> ${error.message}`;
            modalBody.appendChild(errorDiv);

            // Réactiver les boutons
            downloadBtn.textContent = 'Télécharger manuellement';
            downloadBtn.disabled = false;
            downloadBtn.onclick = () => {
                // Fallback : ouvrir le lien manuel
                const manualUrl = downloadBtn.dataset.downloadUrl;
                if (manualUrl) {
                    window.open(manualUrl, '_blank');
                }
            };
            skipBtn.disabled = false;
        }
    },

    /**
     * Télécharge la mise à jour (legacy - pour fallback)
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
