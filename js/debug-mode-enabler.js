/**
 * Module d'activation automatique du PlayerDebugMode sur Mac
 * Permet les mises à jour automatiques sans casser la signature du .zxp
 */

const DebugModeEnabler = {
    /**
     * Vérifie si on est sur Mac
     */
    isMac: function() {
        return navigator.platform.toLowerCase().indexOf('mac') >= 0;
    },

    /**
     * Copie la commande dans le presse-papier
     */
    copyCommandToClipboard: function() {
        const command = 'defaults write com.adobe.CSXS.9 PlayerDebugMode 1 && defaults write com.adobe.CSXS.10 PlayerDebugMode 1 && defaults write com.adobe.CSXS.11 PlayerDebugMode 1 && defaults write com.adobe.CSXS.12 PlayerDebugMode 1 && echo "✅ PlayerDebugMode activé! Relancez Illustrator."';

        try {
            // Créer un élément textarea temporaire
            const textarea = document.createElement('textarea');
            textarea.value = command;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            return true;
        } catch (error) {
            console.error('❌ Erreur lors de la copie:', error);
            return false;
        }
    },

    /**
     * Affiche une popup avec les instructions pour activer les mises à jour
     */
    showInstructionsModal: function() {
        const command = 'defaults write com.adobe.CSXS.9 PlayerDebugMode 1 && defaults write com.adobe.CSXS.10 PlayerDebugMode 1 && defaults write com.adobe.CSXS.11 PlayerDebugMode 1 && defaults write com.adobe.CSXS.12 PlayerDebugMode 1 && echo "✅ PlayerDebugMode activé! Relancez Illustrator."';

        const modal = document.createElement('div');
        modal.id = 'debug-mode-instructions-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 600px;
                text-align: left;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <h2 style="margin: 0 0 20px 0; color: #333; text-align: center;">Configuration des mises à jour automatiques</h2>

                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: #333; font-weight: 500;">📝 Instructions :</p>
                    <ol style="margin: 0; padding-left: 20px; color: #666; line-height: 1.8;">
                        <li>Cliquez sur le bouton <strong>"Copier la commande"</strong> ci-dessous</li>
                        <li>Ouvrez <strong>Terminal</strong> (Applications → Utilitaires → Terminal)</li>
                        <li>Collez la commande (Cmd+V) et appuyez sur <strong>Entrée</strong></li>
                        <li>Fermez Illustrator et <strong>relancez-le</strong></li>
                    </ol>
                </div>

                <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-family: monospace; font-size: 11px; word-break: break-all; border: 1px solid #ddd;">
                    ${command}
                </div>

                <div style="text-align: center; margin-bottom: 20px;">
                    <button id="copy-command-btn" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        margin-right: 10px;
                    ">
                        📋 Copier la commande
                    </button>
                </div>

                <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                    <p style="margin: 0; color: #856404; font-size: 13px;">
                        ⚠️ Cette configuration est nécessaire <strong>une seule fois</strong> pour permettre les mises à jour automatiques.
                    </p>
                </div>

                <div style="text-align: center;">
                    <button id="close-modal-btn" style="
                        background: #2196F3;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">
                        J'ai compris
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Gestionnaire du bouton "Copier"
        document.getElementById('copy-command-btn').addEventListener('click', () => {
            const success = this.copyCommandToClipboard();
            const btn = document.getElementById('copy-command-btn');
            if (success) {
                btn.textContent = '✅ Copié!';
                btn.style.background = '#4CAF50';
                setTimeout(() => {
                    btn.textContent = '📋 Copier la commande';
                }, 2000);
            } else {
                btn.textContent = '❌ Erreur';
                btn.style.background = '#f44336';
            }
        });

        // Gestionnaire du bouton "J'ai compris"
        document.getElementById('close-modal-btn').addEventListener('click', () => {
            modal.remove();
            localStorage.setItem('debug_mode_configured', 'true');
        });
    },

    /**
     * Initialise et active le PlayerDebugMode si nécessaire
     * Appeler au démarrage du plugin
     */
    init: function() {
        // Vérifier si on a déjà effectué la configuration
        const alreadyConfigured = localStorage.getItem('debug_mode_configured');

        if (alreadyConfigured === 'true') {
            console.log('✓ PlayerDebugMode déjà configuré');
            return;
        }

        // Vérifier si on est sur Mac
        if (!this.isMac()) {
            console.log('✓ Windows détecté - PlayerDebugMode non requis');
            localStorage.setItem('debug_mode_configured', 'true');
            return;
        }

        // Mac : afficher les instructions avec la commande à copier
        console.log('🔧 Mac détecté - Affichage des instructions...');
        this.showInstructionsModal();
    }
};

// Auto-initialisation au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Attendre 3 secondes après le chargement pour ne pas bloquer le démarrage
        setTimeout(() => DebugModeEnabler.init(), 3000);
    });
} else {
    setTimeout(() => DebugModeEnabler.init(), 3000);
}
