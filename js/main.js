// Encapsulation pour éviter la pollution du scope global
(function() {
    'use strict';

// Instance de CSInterface (dans le scope de l'IIFE)
let csInterface;

// État de l'application
const appState = {
  selections: {
    horizontal: null,
    vertical: null,
    icon: null,
    text: null,
    custom1: null,
    custom2: null,
    custom3: null
  },
  customVariationsCount: 0, // Nombre de variations custom ajoutées (max 3)
  artboardTypes: {
    fit: true,
    square: true
   },
  artboardMargins: {
    fit: 0,     // Marge en % pour fit-content
    square: 10  // Marge en % pour carré
   },
  colorVariations: {
    original: true,
    blackwhite: false,
    monochrome: false,
    monochromeColor: '#000000',
    monochromeLight: false,
    monochromeLightColor: '#ffffff',
    custom: false
  },
  customColors: {
    enabled: false,
    mapping: [] // [{original: '#ffffff', custom: '#000000'}, ...]
  },
  artboardSize: 1000,
  exportFormats: {
  png: false,
  jpg: false,
  svg: false,
  ai:  false,
  pdf: false
},
exportSizes: {
  1000: true,
  2000: false,
  4000: false
}, 
customSizeEnabled: false,
customSize: { width: 1000, height: 1000 },
lockAspectRatio: true,
initialAspectRatio: 1.0, // Stocker le ratio initial pour éviter la dérive
faviconEnabled: false, // Export favicon 32x32 (uniquement pour icon)
outputFolder: '',
documentSettings: {
  colorMode: 'RGB',  // RGB ou CMYK
  ppi: 72            // Résolution en PPI
}

};

// Initialisation
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('Initializing Logo Déclinaisons...');

    try {
        // Initialiser i18n (applique la langue sauvegardée)
        if (typeof I18N !== 'undefined') {
            I18N.init();
            var langSel = document.getElementById('lang-select');
            if (langSel) {
                langSel.value = I18N.currentLang;
                langSel.addEventListener('change', function() {
                    I18N.setLang(this.value);
                });
            }
        }

        csInterface = new CSInterface();

        // Initialiser le système de trial/licensing
        await initTrialSystem();
        updateLicenseKeyButton();

        setupEventListeners();
        updateTabNavigationButtons(); // Initialiser l'état des boutons de navigation
        updateUI();
        loadFontList(); // Charger les polices pour l'autocomplétion (non bloquant)
        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Failed to initialize:', error);
        showStatus('Erreur d\'initialisation', 'error');
    }
}

/**
 * Initialise le système de trial et met à jour l'interface
 */
async function initTrialSystem() {
    try {
        const status = await Trial.init();

        // Mettre à jour le badge
        updateTrialBadge(status);

        console.log('✓ Trial system initialized:', status);
    } catch (error) {
        console.error('❌ Erreur init trial system:', error);
    }
}

/**
 * Met à jour le badge de trial dans l'interface
 */
function updateTrialBadge(status) {
    const badge = document.getElementById('trial-badge');
    const text = document.getElementById('trial-text');

    if (!badge || !text) return;

    if (status.type === 'licensed') {
        // License activée → cacher le badge (notification suffit)
        badge.style.display = 'none';
    } else if (status.type === 'trial') {
        badge.style.display = 'block';

        // Trial en erreur (serveur inaccessible)
        if (status.error) {
            badge.className = 'trial-badge expired';
            text.textContent = '❌ Connexion requise (Trial)';
            return;
        }

        const remaining = status.generationsRemaining;

        if (remaining === 0) {
            // Trial épuisé
            badge.className = 'trial-badge expired';
            text.textContent = '🔒 Trial épuisé - Activez une license';
        } else if (remaining <= 2) {
            // Dernières générations
            badge.className = 'trial-badge warning';
            text.textContent = `⚠️ ${remaining} génération${remaining > 1 ? 's' : ''} gratuite${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`;
        } else {
            // Trial normal
            badge.className = 'trial-badge';
            text.textContent = `🎁 ${remaining}/${status.generationsLimit} générations gratuites`;
        }
    }
}


function updateExportSizes(event) {
  const checkbox = event.target;
  const size = parseInt(checkbox.value, 10);
  appState.exportSizes[size] = checkbox.checked;
  updateUI();
}

// Gestion des onglets
function switchTab(event) {
    const targetTab = event.target.dataset.tab;

    // Retirer la classe active de tous les boutons et contenus
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Ajouter la classe active au bouton et contenu ciblé
    event.target.classList.add('active');
    document.getElementById(`tab-${targetTab}`).classList.add('active');

    // Mettre à jour les boutons de navigation
    updateTabNavigationButtons();
}

// Obtenir l'index de l'onglet actif
function getCurrentTabIndex() {
    const tabs = ['selection', 'colors', 'export'];
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return 0;
    const tabId = activeTab.id.replace('tab-', '');
    return tabs.indexOf(tabId);
}

// Activer un onglet par son index
function activateTabByIndex(index) {
    const tabs = ['selection', 'colors', 'export'];
    if (index < 0 || index >= tabs.length) return;

    const tabName = tabs[index];

    // Retirer la classe active de tous les boutons et contenus
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Activer le bon onglet
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    const targetContent = document.getElementById(`tab-${tabName}`);

    if (targetButton) targetButton.classList.add('active');
    if (targetContent) targetContent.classList.add('active');

    updateTabNavigationButtons();
}

// Navigation vers l'onglet précédent
function goToPrevTab() {
    const currentIndex = getCurrentTabIndex();
    if (currentIndex > 0) {
        activateTabByIndex(currentIndex - 1);
    }
}

// Navigation vers l'onglet suivant
function goToNextTab() {
    const currentIndex = getCurrentTabIndex();
    if (currentIndex < 2) {
        activateTabByIndex(currentIndex + 1);
    }
}

// Ajouter une variation custom
function addCustomVariation() {
    if (appState.customVariationsCount >= 3) {
        showStatus('Maximum 3 variations custom', 'warning');
        return;
    }

    appState.customVariationsCount++;
    const variationId = `custom${appState.customVariationsCount}`;

    const container = document.getElementById('custom-variations-container');

    // Créer la nouvelle ligne de sélection
    const variationDiv = document.createElement('div');
    variationDiv.className = 'selection-item';
    variationDiv.id = `variation-${variationId}`;
    variationDiv.innerHTML = `
        <label>
            <input type="text" id="label-${variationId}" placeholder="Nom du custom"
                   value="Custom ${appState.customVariationsCount}"
                   style="border: none; background: transparent; font-weight: bold; width: 150px;">
        </label>
        <div class="selection-controls">
            <span class="selection-status" id="status-${variationId}">Pas sélect</span>
            <button class="btn-select" data-type="${variationId}">Valider</button>
            <button class="btn-remove" data-variation="${variationId}" style="margin-left: 0.5em; width: 24px; height: 24px; background: #d9534f; color: white; border: none; border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0;">✕</button>
        </div>
    `;

    container.appendChild(variationDiv);

    // Ajouter event listener pour le bouton de sélection
    const selectBtn = variationDiv.querySelector('.btn-select');
    selectBtn.addEventListener('click', handleSelection);

    // Ajouter event listener pour le bouton de suppression
    const removeBtn = variationDiv.querySelector('.btn-remove');
    removeBtn.addEventListener('click', (e) => {
        const varId = e.target.dataset.variation;
        removeCustomVariation(varId);
    });

    // Mettre à jour l'interface
    updateCustomVariationsUI();
    updateUI();
}

// Supprimer une variation custom
function removeCustomVariation(variationId) {
    const variationDiv = document.getElementById(`variation-${variationId}`);
    if (variationDiv) {
        variationDiv.remove();
    }

    // Réinitialiser la sélection
    appState.selections[variationId] = null;

    // Recalculer le nombre de variations (compter les divs restants)
    const container = document.getElementById('custom-variations-container');
    appState.customVariationsCount = container.children.length;

    updateCustomVariationsUI();
    updateUI();
}

// Mettre à jour l'interface des variations custom
function updateCustomVariationsUI() {
    const addBtn = document.getElementById('add-variation-btn');

    if (addBtn) {
        addBtn.disabled = appState.customVariationsCount >= 3;
    }
}

// Mettre à jour l'état des boutons de navigation
function updateTabNavigationButtons() {
    const currentIndex = getCurrentTabIndex();
    const prevBtn = document.getElementById('prev-tab-btn');
    const nextBtn = document.getElementById('next-tab-btn');

    // Onglet 1 (index 0): seulement "Suivant" actif
    // Onglet 2 (index 1): les deux actifs
    // Onglet 3 (index 2): seulement "Précédent" actif

    prevBtn.disabled = (currentIndex === 0);
    nextBtn.disabled = (currentIndex === 2);
}

function setupEventListeners() {
    // Onglets
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });

    // Navigation entre onglets
    document.getElementById('prev-tab-btn').addEventListener('click', goToPrevTab);
    document.getElementById('next-tab-btn').addEventListener('click', goToNextTab);

    // Boutons de sélection
    document.querySelectorAll('.btn-select').forEach(btn => {
        btn.addEventListener('click', handleSelection);
    });

     // Bouton de génération variation horizontale
        const horizontalLayoutBtn = document.getElementById('generate-horizontal-layout');
    if (horizontalLayoutBtn) {
        horizontalLayoutBtn.addEventListener('click', generateHorizontalLayout);
    }
    // Bouton de génération variation verticale
    const verticalLayoutBtn = document.getElementById('generate-vertical-layout');
    if (verticalLayoutBtn) {
        verticalLayoutBtn.addEventListener('click', generateVerticalLayout);
    }

    // écouteur colorpicker monochromie (bouton avec app.showColorPicker natif)
    const monochromeColorPicker = document.getElementById('black-color-picker');
    if (monochromeColorPicker) {
        monochromeColorPicker.addEventListener('click', async () => {
            // Passer la couleur actuelle au dialogue
            const selectedColor = await openNativeColorPicker(appState.colorVariations.monochromeColor);
            if (selectedColor) {
                appState.colorVariations.monochromeColor = selectedColor;
                monochromeColorPicker.style.backgroundColor = selectedColor;
                updateUI();
            }
        });
    }

    // écouteur colorpicker monochromie light (bouton avec app.showColorPicker natif)
    const monochromeLightColorPicker = document.getElementById('light-color-picker');
    if (monochromeLightColorPicker) {
        monochromeLightColorPicker.addEventListener('click', async () => {
            // Passer la couleur actuelle au dialogue
            const selectedColor = await openNativeColorPicker(appState.colorVariations.monochromeLightColor);
            if (selectedColor) {
                appState.colorVariations.monochromeLightColor = selectedColor;
                monochromeLightColorPicker.style.backgroundColor = selectedColor;
                updateUI();
            }
        });
    }
    // Checkboxes types d'artboard
    const fitCheckbox = document.getElementById('artboard-fit');
    const squareCheckbox = document.getElementById('artboard-square');

    if (fitCheckbox) {
        fitCheckbox.addEventListener('change', updateArtboardTypes);
    }
    if (squareCheckbox) {
        squareCheckbox.addEventListener('change', updateArtboardTypes);
    }

    // Range inputs pour les marges
    const marginFitInput = document.getElementById('margin-fit');
    const marginFitValue = document.getElementById('margin-fit-value');
    if (marginFitInput && marginFitValue) {
        marginFitInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            appState.artboardMargins.fit = value;
            marginFitValue.textContent = value;
        });
    }

    const marginSquareInput = document.getElementById('margin-square');
    const marginSquareValue = document.getElementById('margin-square-value');
    if (marginSquareInput && marginSquareValue) {
        marginSquareInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            appState.artboardMargins.square = value;
            marginSquareValue.textContent = value;
        });
    }

    // Slider zone de protection
    const zoneMarginInput = document.getElementById('zone-margin');
    const zoneMarginValue = document.getElementById('zone-margin-value');
    if (zoneMarginInput && zoneMarginValue) {
        zoneMarginInput.addEventListener('input', (e) => {
            zoneMarginValue.textContent = e.target.value;
        });
    }

    // Initialiser l'affichage des marges au démarrage
    updateMarginsVisibility();

    // Checkboxes couleurs
    const bwCheckbox = document.getElementById('color-bw');
    if (bwCheckbox) {
        bwCheckbox.addEventListener('change', updateColorVariations);
    }
    const monochromeCheckbox = document.getElementById('color-black'); // Checkbox pour monochromie
    if (monochromeCheckbox) {
        monochromeCheckbox.addEventListener('change', updateColorVariations);
    }

    const monochromeLightCheckbox = document.getElementById('color-light'); // Checkbox pour monochromie light
    if (monochromeLightCheckbox) {
        monochromeLightCheckbox.addEventListener('change', updateColorVariations);
    }

    const customCheckbox = document.getElementById('color-custom');
    if (customCheckbox) {
        customCheckbox.addEventListener('change', updateColorVariations);
    }

    // Paramètres du document
    const colorModeSelect = document.getElementById('color-mode');
    if (colorModeSelect) {
        colorModeSelect.addEventListener('change', (e) => {
            appState.documentSettings.colorMode = e.target.value;
            console.log('Mode couleur changé:', e.target.value);
        });
    }

    const documentPpiInput = document.getElementById('document-ppi');
    if (documentPpiInput) {
        documentPpiInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value, 10);
            // Validation: limiter entre 1 et 999
            if (isNaN(value) || value < 1) value = 1;
            if (value > 999) value = 999;
            appState.documentSettings.ppi = value;
            e.target.value = value; // Mettre à jour l'input si la valeur a été corrigée
        });
    }

    // Bouton d'analyse des couleurs
    const analyzeColorsBtn = document.getElementById('analyze-colors-btn');
    if (analyzeColorsBtn) {
        analyzeColorsBtn.addEventListener('click', analyzeColors);
    }
    
    //  parametre d'export
    document.getElementById('export-png').addEventListener('change', updateExportFormats);
    document.getElementById('export-jpg').addEventListener('change', updateExportFormats);
    document.getElementById('export-svg').addEventListener('change', updateExportFormats);
    document.getElementById('export-ai').addEventListener('change', updateExportFormats);
    document.getElementById('export-pdf').addEventListener('change', updateExportFormats);

    // Checkboxes des tailles d'export
    document.getElementById('size-small').addEventListener('change', updateExportSizes);
    document.getElementById('size-medium').addEventListener('change', updateExportSizes);
    document.getElementById('size-large').addEventListener('change', updateExportSizes);

    // Custom size toggle
    const customEnable = document.getElementById('custom-size-enable');
    customEnable.addEventListener('change', (e) => {
    appState.customSizeEnabled = e.target.checked;
    document.getElementById('custom-size-inputs').style.display = e.target.checked ? 'block' : 'none';
    updateUI();
    });

    // Favicon toggle
    const faviconEnable = document.getElementById('favicon-enable');
    if (faviconEnable) {
        faviconEnable.addEventListener('change', (e) => {
            appState.faviconEnabled = e.target.checked;
            updateUI();
        });
    }
    // Width / Height inputs
    const lockCheckbox = document.getElementById('lock-aspect-ratio');

    // Quand on modifie la largeur
    document.getElementById('custom-width').addEventListener('change', (e) => {
      const newWidth = parseInt(e.target.value, 10) || 1;
      if (appState.lockAspectRatio) {
        // Utiliser le ratio initial pour éviter la dérive
        const newHeight = Math.max(1, Math.round(newWidth * appState.initialAspectRatio));
        appState.customSize.width  = newWidth;
        appState.customSize.height = newHeight;
        document.getElementById('custom-height').value = newHeight;
      } else {
        appState.customSize.width = newWidth;
        // Si on change la largeur sans lock, mettre à jour le ratio initial
        appState.initialAspectRatio = appState.customSize.height / newWidth;
      }
      updateUI();
    });

    // Input de lancement des génération automatique verticale et horizontale
    async function generateHorizontalLayout() {
    try {
        showStatus('Génération de la version horizontale...', 'warning');

        const result = await evalExtendScript('generateHorizontalVersion');
        if (result === 'OK') {
            showStatus('Version horizontale générée !', 'success');

            // 🎯 Auto-sélection de la variation générée
            try {
                const storeResult = await evalExtendScript('storeSelection', ['horizontal']);
                if (storeResult === 'OK') {
                    appState.selections.horizontal = true;
                    const statusEl = document.getElementById('status-horizontal');
                    if (statusEl) {
                        statusEl.textContent = 'Sélectionné ✓';
                        statusEl.classList.add('selected');
                    }
                    const btnEl = document.querySelector('.btn-select[data-type="horizontal"]');
                    if (btnEl) btnEl.classList.add('selected');
                    updateUI();
                    showStatus('Version horizontale générée et sélectionnée !', 'success');
                }
            } catch (autoSelectError) {
                console.warn('Auto-sélection échouée:', autoSelectError);
                // Ne pas bloquer si l'auto-sélection échoue
            }
        } else {
            showStatus('Erreur : ' + result, 'error');
        }
    } catch (e) {
        console.error(e);
        showStatus('Erreur lors de la génération', 'error');
    }
    }
    async function generateVerticalLayout() {
    try {
        showStatus('Génération de la version verticale...', 'warning');

        const result = await evalExtendScript('generateVerticalVersion');
        if (result === 'OK') {
            showStatus('Version verticale générée !', 'success');

            // 🎯 Auto-sélection de la variation générée
            try {
                const storeResult = await evalExtendScript('storeSelection', ['vertical']);
                if (storeResult === 'OK') {
                    appState.selections.vertical = true;
                    const statusEl = document.getElementById('status-vertical');
                    if (statusEl) {
                        statusEl.textContent = 'Sélectionné ✓';
                        statusEl.classList.add('selected');
                    }
                    const btnEl = document.querySelector('.btn-select[data-type="vertical"]');
                    if (btnEl) btnEl.classList.add('selected');
                    updateUI();
                    showStatus('Version verticale générée et sélectionnée !', 'success');
                }
            } catch (autoSelectError) {
                console.warn('Auto-sélection échouée:', autoSelectError);
                // Ne pas bloquer si l'auto-sélection échoue
            }
        } else {
            showStatus(`Erreur: ${result}`, 'error');
        }
    } catch (e) {
        console.error(e);
        showStatus('Erreur lors de la génération verticale', 'error');
    }
}



    // Quand on modifie la hauteur
    document.getElementById('custom-height').addEventListener('change', (e) => {
      const newHeight = parseInt(e.target.value, 10) || 1;
      if (appState.lockAspectRatio) {
        // Utiliser l'inverse du ratio initial pour éviter la dérive
        const newWidth = Math.max(1, Math.round(newHeight / appState.initialAspectRatio));
        appState.customSize.height = newHeight;
        appState.customSize.width  = newWidth;
        document.getElementById('custom-width').value = newWidth;
      } else {
        appState.customSize.height = newHeight;
        // Si on change la hauteur sans lock, mettre à jour le ratio initial
        appState.initialAspectRatio = newHeight / appState.customSize.width;
      }
      updateUI();
    });

    // Écouteur sur la case à cocher
    if (lockCheckbox) {
      lockCheckbox.addEventListener('change', (e) => {
        appState.lockAspectRatio = e.target.checked;
      });
    }

    const browseBtn = document.getElementById('browse-folder');
    if (browseBtn) {
    browseBtn.addEventListener('click', browseFolder);
    }

    // Bouton d'ajout de variation custom
    const addVariationBtn = document.getElementById('add-variation-btn');
    if (addVariationBtn) {
        addVariationBtn.addEventListener('click', addCustomVariation);
    }

    // Bouton générer (artboards seulement)
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Bouton exporter (artboards + fichiers)
    const exportBtnEl = document.getElementById('export-btn');
    if (exportBtnEl) {
        exportBtnEl.addEventListener('click', handleExport);
    }

    // Checkbox présentation InDesign : toggle options
    const presentationCheckbox = document.getElementById('presentation-enable');
    if (presentationCheckbox) {
        presentationCheckbox.addEventListener('change', function() {
            var opts = document.getElementById('presentation-options');
            if (opts) opts.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Bouton reset
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            resetSelections();
            // Réinitialiser aussi les inputs de présentation
            var brandNameInput = document.getElementById('brand-name');
            if (brandNameInput) brandNameInput.value = '';
            var fontPrimary = document.getElementById('brand-font-primary');
            if (fontPrimary) fontPrimary.value = '';
            var fontSecondary = document.getElementById('brand-font-secondary');
            if (fontSecondary) fontSecondary.value = '';
            // Réinitialiser les sélections ExtendScript
            evalExtendScript('clearStoredSelections').catch(function() {});
            showStatus('Paramètres réinitialisés.', 'success');
        });
    }

    // Bouton re-tester mockups (PS → InDesign) sans tout regénérer
    const btnRerunMockups = document.getElementById('btn-rerun-mockups');
    if (btnRerunMockups) {
        btnRerunMockups.addEventListener('click', handleRerunMockups);
    }

    // DEBUG: Bouton reset trial
    const resetTrialBtn = document.getElementById('reset-trial-btn');
    if (resetTrialBtn) {
        resetTrialBtn.addEventListener('click', async () => {
            if (confirm('Réinitialiser le trial ?\n\nCela va remettre le compteur à 7/7 (local + serveur).')) {
                try {
                    // Afficher un message de chargement
                    showStatus('Réinitialisation en cours...', 'warning');

                    // Réinitialiser le trial (local + serveur)
                    await Trial.reset();

                    // Rafraîchir le statut
                    const status = await Trial.init();
                    updateTrialBadge(status);

                    showStatus('✓ Trial réinitialisé ! 7/7 générations disponibles', 'success');
                } catch (error) {
                    console.error('Erreur reset:', error);
                    showStatus('⚠️ Erreur lors de la réinitialisation', 'error');
                }
            }
        });
    }

    // License Key Button & Modal
    const licenseKeyBtn = document.getElementById('license-key-btn');
    const licenseModal = document.getElementById('license-modal');
    const closeLicenseModal = document.getElementById('close-license-modal');
    const cancelLicenseBtn = document.getElementById('cancel-license-btn');
    const activateLicenseSubmitBtn = document.getElementById('activate-license-submit-btn');
    const deactivateLicenseBtn = document.getElementById('deactivate-license-btn');

    if (licenseKeyBtn) {
        licenseKeyBtn.addEventListener('click', openLicenseModal);
    }

    if (closeLicenseModal) {
        closeLicenseModal.addEventListener('click', () => {
            licenseModal.style.display = 'none';
        });
    }

    if (cancelLicenseBtn) {
        cancelLicenseBtn.addEventListener('click', () => {
            licenseModal.style.display = 'none';
        });
    }

    if (activateLicenseSubmitBtn) {
        activateLicenseSubmitBtn.addEventListener('click', handleLicenseActivation);
    }

    if (deactivateLicenseBtn) {
        deactivateLicenseBtn.addEventListener('click', handleLicenseDeactivation);
    }

    // Fermer la modal en cliquant en dehors
    if (licenseModal) {
        licenseModal.addEventListener('click', (e) => {
            if (e.target === licenseModal) {
                licenseModal.style.display = 'none';
            }
        });
    }

    // === UPDATE MODAL ===
    const updateModal = document.getElementById('update-modal');
    const closeUpdateModal = document.getElementById('close-update-modal');
    const updateSkipBtn = document.getElementById('update-skip-btn');
    const updateDownloadBtn = document.getElementById('update-download-btn');

    if (closeUpdateModal) {
        closeUpdateModal.addEventListener('click', () => {
            UpdateChecker.closeUpdateModal();
        });
    }

    if (updateSkipBtn) {
        updateSkipBtn.addEventListener('click', () => {
            UpdateChecker.closeUpdateModal();
        });
    }

    if (updateDownloadBtn) {
        updateDownloadBtn.addEventListener('click', () => {
            // Ouvrir le lien de download dans le navigateur (pas d'auto-écrasement)
            var url = updateDownloadBtn.dataset.downloadUrl;
            if (url) {
                window.cep && window.cep.util
                    ? window.cep.util.openURLInDefaultBrowser(url)
                    : window.open(url, '_blank');
            }
            UpdateChecker.closeUpdateModal();
        });
    }

    // Fermer la modal en cliquant en dehors
    if (updateModal) {
        updateModal.addEventListener('click', (e) => {
            if (e.target === updateModal) {
                UpdateChecker.closeUpdateModal();
            }
        });
    }

}

/**
 * Ouvre la modal de licence (activation ou manage)
 */
async function openLicenseModal() {
    const licenseModal = document.getElementById('license-modal');
    const activationForm = document.getElementById('license-activation-form');
    const licenseInfo = document.getElementById('license-info-display');
    const activateBtn = document.getElementById('activate-license-submit-btn');
    const deactivateBtn = document.getElementById('deactivate-license-btn');
    const errorDiv = document.getElementById('license-error');
    const successDiv = document.getElementById('license-success');

    // Reset messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Vérifier si une licence est active
    const license = Trial.getStoredLicense();

    if (license && license.active) {
        // Afficher les infos de la licence
        activationForm.style.display = 'none';
        licenseInfo.style.display = 'block';
        activateBtn.style.display = 'none';
        deactivateBtn.style.display = 'inline-block';

        // Remplir les infos
        document.getElementById('license-type-display').textContent =
            license.type === 'lifetime' ? 'Lifetime (à vie)' : 'Mensuelle';
        document.getElementById('license-key-display').textContent =
            license.key.substring(0, 10) + '...';
    } else {
        // Afficher le formulaire d'activation
        activationForm.style.display = 'block';
        licenseInfo.style.display = 'none';
        activateBtn.style.display = 'inline-block';
        deactivateBtn.style.display = 'none';

        // Reset formulaire
        document.getElementById('license-key-input').value = '';
    }

    licenseModal.style.display = 'flex';
}

/**
 * Met à jour le bouton License Key selon l'état
 */
function updateLicenseKeyButton() {
    const licenseKeyBtn = document.getElementById('license-key-btn');
    const licenseKeyText = document.getElementById('license-key-text');

    if (!licenseKeyBtn || !licenseKeyText) return;

    const license = Trial.getStoredLicense();
    const resetTrialBtn = document.getElementById('reset-trial-btn');

    if (license && license.active) {
        // Licence active
        licenseKeyBtn.classList.add('active');
        licenseKeyText.textContent = '✓ Licensed';

        // Cacher le bouton reset trial et le badge
        if (resetTrialBtn && resetTrialBtn.parentElement) {
            resetTrialBtn.parentElement.style.display = 'none';
        }
    } else {
        // Mode trial
        licenseKeyBtn.classList.remove('active');
        licenseKeyText.textContent = 'License Key';

        // Afficher le bouton reset trial
        if (resetTrialBtn && resetTrialBtn.parentElement) {
            resetTrialBtn.parentElement.style.display = 'block';
        }
    }
}

/**
 * Gère l'activation de licence
 */
async function handleLicenseActivation() {
    const licenseKey = document.getElementById('license-key-input').value.trim();
    const errorDiv = document.getElementById('license-error');
    const successDiv = document.getElementById('license-success');
    const submitBtn = document.getElementById('activate-license-submit-btn');

    // Reset messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validation
    if (!licenseKey) {
        errorDiv.textContent = 'Veuillez entrer une clé de licence.';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        // Désactiver le bouton pendant l'activation
        submitBtn.disabled = true;
        submitBtn.textContent = 'Activation en cours...';

        // Récupérer le HWID
        const hwid = await HWID.get();

        // Appeler l'API d'activation (email par défaut pour la compatibilité backend)
        const response = await fetch('https://logotyps.vercel.app/api/license/activate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                licenseKey: licenseKey,
                email: 'user@license.local',
                hwid: hwid
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Stocker la licence
            Trial.storeLicense({
                active: true,
                key: licenseKey,
                email: 'user@license.local',
                type: data.licenseType || 'lifetime',
                activatedAt: Date.now()
            });

            // Afficher le succès
            successDiv.textContent = '✓ Licence activée avec succès ! Vous avez maintenant un accès illimité.';
            successDiv.style.display = 'block';

            // Mettre à jour le badge et le bouton
            const status = await Trial.getStatus();
            updateTrialBadge(status);
            updateLicenseKeyButton();

            // Fermer la modal après 2 secondes
            setTimeout(() => {
                document.getElementById('license-modal').style.display = 'none';
                showStatus('✓ Licence activée ! Générations illimitées', 'success');
            }, 2000);

        } else {
            // Afficher l'erreur
            errorDiv.textContent = data.message || 'Erreur lors de l\'activation de la licence.';
            errorDiv.style.display = 'block';
        }

    } catch (error) {
        console.error('Erreur activation licence:', error);
        errorDiv.textContent = 'Erreur de connexion au serveur. Vérifiez votre connexion Internet.';
        errorDiv.style.display = 'block';
    } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.textContent = 'Activer';
    }
}

/**
 * Gère la désactivation de licence
 */
async function handleLicenseDeactivation() {
    const errorDiv = document.getElementById('license-error');
    const successDiv = document.getElementById('license-success');
    const deactivateBtn = document.getElementById('deactivate-license-btn');

    if (!confirm('Êtes-vous sûr de vouloir désactiver cette licence sur cet appareil ?\n\nCela libérera une activation pour l\'utiliser sur un autre appareil.')) {
        return;
    }

    try {
        // Désactiver le bouton
        deactivateBtn.disabled = true;
        deactivateBtn.textContent = 'Désactivation...';

        // Récupérer la licence et le HWID
        const license = Trial.getStoredLicense();
        const hwid = await HWID.get();

        if (!license) {
            throw new Error('Aucune licence trouvée');
        }

        // Essayer d'abord la désactivation normale
        const response = await fetch('https://logotyps.vercel.app/api/license/deactivate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                licenseKey: license.key,
                hwid: hwid
            })
        });

        const data = await response.json();

        // Si échec à cause de l'instance_id manquant, utiliser force-deactivate
        if (!response.ok && data.message && data.message.includes('Instance ID manquant')) {
            console.log('⚠️ Instance ID manquant, utilisation de force-deactivate...');

            const forceResult = await Trial.forceLicenseDeactivate();

            if (forceResult.success) {
                // Afficher le succès
                successDiv.textContent = '✓ Licence désactivée avec succès.';
                successDiv.style.display = 'block';

                // Mettre à jour l'interface
                const status = await Trial.getStatus();
                updateTrialBadge(status);
                updateLicenseKeyButton();

                // Fermer la modal après 2 secondes
                setTimeout(() => {
                    document.getElementById('license-modal').style.display = 'none';
                    showStatus('Licence désactivée. Retour au mode trial.', 'success');
                }, 2000);
            } else {
                errorDiv.textContent = forceResult.message || 'Erreur lors de la désactivation.';
                errorDiv.style.display = 'block';
            }
        } else if (response.ok && data.success) {
            // Désactivation normale réussie
            localStorage.removeItem('_license');

            // Afficher le succès
            successDiv.textContent = '✓ Licence désactivée avec succès.';
            successDiv.style.display = 'block';

            // Mettre à jour l'interface
            const status = await Trial.getStatus();
            updateTrialBadge(status);
            updateLicenseKeyButton();

            // Fermer la modal après 2 secondes
            setTimeout(() => {
                document.getElementById('license-modal').style.display = 'none';
                showStatus('Licence désactivée. Retour au mode trial.', 'success');
            }, 2000);
        } else {
            // Autre erreur
            errorDiv.textContent = data.message || 'Erreur lors de la désactivation.';
            errorDiv.style.display = 'block';
        }

    } catch (error) {
        console.error('Erreur désactivation licence:', error);
        errorDiv.textContent = 'Erreur de connexion au serveur.';
        errorDiv.style.display = 'block';
    } finally {
        // Réactiver le bouton
        deactivateBtn.disabled = false;
        deactivateBtn.textContent = 'Désactiver';
    }
}

async function handleSelection(event) {
    const type = event.target.dataset.type;
    const button = event.target;

    console.log('Handling selection for type:', type);

    // Prévenir les race conditions en désactivant tous les boutons de sélection
    const allSelectButtons = document.querySelectorAll('.btn-select');
    allSelectButtons.forEach(btn => btn.disabled = true);

    try {
        // Vérifier qu'un document est ouvert
        const hasDoc = await evalExtendScript('hasOpenDocument');
        if (hasDoc === 'false') {
            showStatus('Aucun document ouvert dans Illustrator. Ouvrez un fichier .ai avant de continuer.', 'error');
            return;
        }

        // Vérifier la sélection
        const selectionInfo = await evalExtendScript('getSelectionInfo');
        if (selectionInfo === 'NO_SELECTION') {
            showStatus('Aucun élément sélectionné dans Illustrator. Sélectionnez un élément puis cliquez sur Sélectionner.', 'warning');
            return;
        }
        if (selectionInfo === 'NO_DOCUMENT') {
            showStatus('Aucun document ouvert dans Illustrator. Ouvrez un fichier .ai avant de continuer.', 'error');
            return;
        }

        // Stocker la sélection
        const result = await evalExtendScript('storeSelection', [type]);
        if (result === 'OK') {
            appState.selections[type] = true;

            // Mettre à jour l'UI
            const statusEl = document.getElementById(`status-${type}`);
            if (statusEl) {
                statusEl.textContent = 'Sélectionné ✓';
                statusEl.classList.add('selected');
            }

            // Ajouter la classe selected au bouton
            button.classList.add('selected');

            showStatus(`${getTypeName(type)} sélectionné`, 'success');
            updateUI();
        } else if (result && result.startsWith('ERROR:')) {
            const errorMsg = result.substring(7);
            showStatus(`Erreur: ${errorMsg}`, 'error');
        } else {
            showStatus('Erreur lors de la sélection', 'error');
        }

    } catch (error) {
        console.error('Selection error:', error);
        const errorMsg = error.message || 'Erreur inconnue';
        showStatus(`Erreur lors de la sélection: ${errorMsg}`, 'error');
    } finally {
        // Réactiver les boutons de sélection
        allSelectButtons.forEach(btn => btn.disabled = false);
    }
}

function updateArtboardTypes() {
    const fitCheckbox = document.getElementById('artboard-fit');
    const squareCheckbox = document.getElementById('artboard-square');

    appState.artboardTypes.fit = fitCheckbox ? fitCheckbox.checked : true;
    appState.artboardTypes.square = squareCheckbox ? squareCheckbox.checked : true;

    // Afficher/masquer les contrôles de marges selon les types cochés
    updateMarginsVisibility();

    updateUI();
}

function updateMarginsVisibility() {
    const fitContainer = document.getElementById('margin-fit-container');
    const squareContainer = document.getElementById('margin-square-container');

    if (fitContainer) {
        fitContainer.style.display = appState.artboardTypes.fit ? 'block' : 'none';
    }
    if (squareContainer) {
        squareContainer.style.display = appState.artboardTypes.square ? 'block' : 'none';
    }
}

function updateColorVariations() {
    const bwCheckbox = document.getElementById('color-bw');
    appState.colorVariations.blackwhite = bwCheckbox ? bwCheckbox.checked : false;
    const monochromeCheckbox = document.getElementById('color-black');
    appState.colorVariations.monochrome = monochromeCheckbox ? monochromeCheckbox.checked : false;
    const monochromeLightCheckbox = document.getElementById('color-light');
    appState.colorVariations.monochromeLight = monochromeLightCheckbox ? monochromeLightCheckbox.checked : false;
    const customCheckbox = document.getElementById('color-custom');
    appState.colorVariations.custom = customCheckbox ? customCheckbox.checked : false;

    // Afficher/masquer la section custom colors
    const customSection = document.getElementById('custom-colors-section');
    if (customSection) {
        customSection.style.display = appState.colorVariations.custom ? 'block' : 'none';
    }

    updateUI();
}

function updateUI() {
  // Afficher/masquer la section favicon selon si icon est sélectionné
  const faviconSection = document.getElementById('favicon-section');
  if (faviconSection) {
    faviconSection.style.display = appState.selections.icon ? 'block' : 'none';
    // Si icon n'est plus sélectionné, décocher favicon automatiquement
    if (!appState.selections.icon && appState.faviconEnabled) {
      appState.faviconEnabled = false;
      const faviconCheckbox = document.getElementById('favicon-enable');
      if (faviconCheckbox) faviconCheckbox.checked = false;
    }
  }

  // Calcul des tailles d'export
  const fixedCount = Object.values(appState.exportSizes).filter(v => v).length;
  const customCount = appState.customSizeEnabled ? 1 : 0;
  const faviconCount = (appState.faviconEnabled && appState.selections.icon) ? 1 : 0;
  const sizeCount  = fixedCount + customCount + faviconCount;

  // Calcul des sélections, types et couleurs
  const selectedCount = Object.values(appState.selections).filter(v => v).length;
  const typeCount     = Object.values(appState.artboardTypes).filter(v => v).length;
  const colorCount    = Object.values(appState.colorVariations).filter(v => v).length;

  // Calcul du total d'artboards (sélections × types × couleurs)
  // Si monochromeLight est activée, on double le nombre d'artboards
  let totalArtboards = selectedCount * typeCount * colorCount;
  if (appState.colorVariations.monochromeLight) {
    // monochromeLight génère 2 artboards au lieu de 1
    const otherColors = colorCount - 1;
    totalArtboards = selectedCount * typeCount * (otherColors + 2);
  }

  // Ajouter les artboards favicon (1 artboard carré par variation de couleur, uniquement pour icon)
  // Les favicons sont toujours en carré avec 10% de marge, indépendamment des choix fit/square
  if (appState.faviconEnabled && appState.selections.icon) {
    let faviconArtboards = colorCount; // 1 artboard par couleur (toujours carré)
    if (appState.colorVariations.monochromeLight) {
      // monochromeLight génère 2 artboards (normal + fond noir)
      faviconArtboards = colorCount + 1;
    }
    totalArtboards += faviconArtboards;
  }

  // Mise à jour du résumé et du bouton
  const summaryEl = document.getElementById('summary');
  const countEl   = document.getElementById('artboard-count');

  if (totalArtboards > 0) {
    summaryEl.style.display = 'block';
    countEl.textContent = totalArtboards;

    // Avertissement si trop d'artboards
    if (totalArtboards > 200) {
      countEl.style.color = 'var(--error-color)';
      countEl.title = '⚠️ Attention : Trop d\'artboards peuvent faire crasher Illustrator';
    } else if (totalArtboards > 100) {
      countEl.style.color = 'var(--warning-color)';
      countEl.title = '⚠️ Attention : Nombre élevé d\'artboards';
    } else {
      countEl.style.color = 'var(--primary-color)';
      countEl.title = '';
    }
  } else {
    summaryEl.style.display = 'none';
  }

  // "Générer" : sélections + types + couleurs suffisent
  document.getElementById('generate-btn').disabled = !(selectedCount > 0 && typeCount > 0 && colorCount > 0);

  // "Exporter" : il faut en plus un dossier, au moins un format et au moins une taille
  const hasFolder = appState.outputFolder && appState.outputFolder !== '';
  const hasFormat = appState.exportFormats.png || appState.exportFormats.jpg || appState.exportFormats.svg || appState.exportFormats.ai || appState.exportFormats.pdf;
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.disabled = !(selectedCount > 0 && typeCount > 0 && colorCount > 0 && sizeCount > 0 && hasFolder && hasFormat);
  }
}

// Logique commune de vérification trial
async function checkTrialAllowed() {
    const canGenerate = await Trial.canGenerate();
    if (!canGenerate.allowed) {
        showStatus(canGenerate.message, 'error');
        if (canGenerate.needsUIUpdate) {
            const newStatus = await Trial.getStatus();
            updateTrialBadge(newStatus);
            updateLicenseKeyButton();
        }
        return false;
    }
    return true;
}

// Générer les plans de travail SEULEMENT (pas d'export fichiers)
async function handleGenerate() {
    const generateBtn = document.getElementById('generate-btn');

    try {
        if (!(await checkTrialAllowed())) return;

        if (generateBtn) generateBtn.disabled = true;
        showStatus('Génération des plans de travail...', 'warning');

        const params = {
            selections: appState.selections,
            artboardTypes: appState.artboardTypes,
            artboardMargins: appState.artboardMargins,
            colorVariations: appState.colorVariations,
            customColors: appState.customColors,
            exportFormats: { png: false, jpg: false, svg: false, ai: false, pdf: false },
            exportSizes: {},
            customSizeEnabled: false,
            customSize: appState.customSize,
            faviconEnabled: appState.faviconEnabled,
            outputFolder: '',
            documentSettings: appState.documentSettings
        };

        const result = await evalExtendScript('generateArtboards', [JSON.stringify(params)], 120000);

        if (result && result.startsWith('SUCCESS')) {
            const count = result.split(':')[1];
            showStatus(`${count} plans de travail créés !`, 'success');

            try {
                await Trial.incrementGeneration();
                const newStatus = await Trial.getStatus();
                updateTrialBadge(newStatus);
            } catch (e) {
                console.error('Erreur incrémentation trial:', e);
            }
        } else if (result && result.startsWith('ERROR')) {
            showStatus(result.substring(6).trim() || 'Erreur inconnue', 'error');
        } else {
            showStatus('Erreur: Réponse invalide', 'error');
        }
    } catch (error) {
        console.error('Generate error:', error);
        showStatus(`Erreur: ${error.message || 'Erreur inconnue'}`, 'error');
    } finally {
        if (generateBtn) generateBtn.disabled = false;
        updateUI();
    }
}

// Exporter les fichiers (génère artboards + exporte dans le dossier)
async function handleExport() {
    const exportBtnEl = document.getElementById('export-btn');

    try {
        if (!(await checkTrialAllowed())) return;

        if (exportBtnEl) exportBtnEl.disabled = true;
        showStatus('Exportation en cours...', 'warning');
        document.body.classList.add('exporting');

        const params = {
            selections: appState.selections,
            artboardTypes: appState.artboardTypes,
            artboardMargins: appState.artboardMargins,
            colorVariations: appState.colorVariations,
            customColors: appState.customColors,
            exportFormats: appState.exportFormats,
            exportSizes: appState.exportSizes,
            customSizeEnabled: appState.customSizeEnabled,
            customSize: appState.customSize,
            faviconEnabled: appState.faviconEnabled,
            outputFolder: appState.outputFolder,
            documentSettings: appState.documentSettings
        };

        const result = await evalExtendScript('generateArtboards', [JSON.stringify(params)], 300000);

        if (result && result.startsWith('SUCCESS')) {
            const count = result.split(':')[1];

            try {
                await Trial.incrementGeneration();
                const newStatus = await Trial.getStatus();
                updateTrialBadge(newStatus);
            } catch (e) {
                console.error('Erreur incrémentation trial:', e);
            }

            // Si la présentation InDesign est cochée, la générer maintenant
            var presentationChecked = document.getElementById('presentation-enable');
            if (presentationChecked && presentationChecked.checked) {
                showStatus('Génération de la présentation InDesign...', 'warning');
                try {
                    await handleGeneratePresentation();
                } catch (presErr) {
                    console.error('Erreur présentation:', presErr);
                    showStatus(`Export OK (${count} artboards) mais erreur présentation: ${presErr.message}`, 'warning');
                }
            }

            showStatus(`Exportation terminée ! ${count} plans de travail exportés.`, 'success');

            // Popup de confirmation
            showExportDonePopup();
        } else if (result && result.startsWith('ERROR')) {
            showStatus(result.substring(6).trim() || 'Erreur inconnue', 'error');
        } else {
            showStatus('Erreur: Réponse invalide', 'error');
        }
    } catch (error) {
        console.error('Export error:', error);
        showStatus(`Erreur: ${error.message || 'Erreur inconnue'}`, 'error');
    } finally {
        if (exportBtnEl) exportBtnEl.disabled = false;
        document.body.classList.remove('exporting');
        updateUI();
    }
}

async function handleGeneratePresentation() {
    try {
        showStatus('Génération de la présentation InDesign...', 'info');

        // Auto-extraire les couleurs originales depuis les SVG exportés sur disque
        // Ne dépend PAS de la sélection Illustrator ni de l'analyse manuelle
        if (!appState.customColors.mapping || appState.customColors.mapping.length === 0) {
            try {
                var fs = require('fs');
                var nodePath = require('path');
                var extractedColors = {};
                var colorBlacklist = { '#000000': 1, '#ffffff': 1, '#fff': 1, '#000': 1, 'none': 1, 'transparent': 1 };
                var logoTypes = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
                for (var lt = 0; lt < logoTypes.length; lt++) {
                    var svgDir = nodePath.join(appState.outputFolder, logoTypes[lt], 'original', 'SVG');
                    if (!fs.existsSync(svgDir)) continue;
                    var svgFiles = fs.readdirSync(svgDir).filter(function(f) { return f.toLowerCase().endsWith('.svg'); });
                    for (var sf = 0; sf < svgFiles.length && Object.keys(extractedColors).length < 10; sf++) {
                        var svgContent = fs.readFileSync(nodePath.join(svgDir, svgFiles[sf]), 'utf8');
                        // Extraire fill="..." et stroke="..."
                        var colorMatches = svgContent.match(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g) || [];
                        for (var cm = 0; cm < colorMatches.length; cm++) {
                            var hex = colorMatches[cm].match(/#[0-9a-fA-F]{3,8}/);
                            if (hex) {
                                var c = hex[0].toLowerCase();
                                // Normaliser les hex courts (#abc → #aabbcc)
                                if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
                                if (!colorBlacklist[c]) extractedColors[c] = true;
                            }
                        }
                    }
                    if (Object.keys(extractedColors).length > 0) break; // Un seul type suffit
                }
                var uniqueColors = Object.keys(extractedColors);
                if (uniqueColors.length > 0) {
                    appState.customColors.mapping = uniqueColors.map(function(c) {
                        return { original: c, custom: c };
                    });
                }
            } catch (autoColorErr) {
                console.warn('Auto SVG color extraction failed:', autoColorErr);
            }
        }

        // Get selected template
        var selectedRadio = document.querySelector('input[name="template"]:checked');
        var templateName = selectedRadio ? selectedRadio.value : 'template-1';
        var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        var nodePath = require('path');

        const config = {
            templatePath: nodePath.join(extensionPath, 'templates', templateName + '.idml'),
            outputFolder: appState.outputFolder,
            extensionPath: extensionPath,
            colors: appState.customColors && appState.customColors.mapping ? appState.customColors.mapping : [],
            brandName: (document.getElementById('brand-name') && document.getElementById('brand-name').value) || 'Logo',
            fontPrimary: (document.getElementById('brand-font-primary') && document.getElementById('brand-font-primary').value) || '',
            fontSecondary: (document.getElementById('brand-font-secondary') && document.getElementById('brand-font-secondary').value) || '',
            monochromeColor: appState.colorVariations.monochromeColor || '#000000',
            monochromeLightColor: appState.colorVariations.monochromeLightColor || '#ffffff',
            protectionZoneMargin: parseInt(document.getElementById('zone-margin').value, 10) || 15
        };

        if (!config.outputFolder) {
            showStatus('Veuillez d\'abord générer les logos (dossier de sortie requis).', 'error');
            return;
        }

        const result = await IDMLGenerator.generate(config);

        if (result.success) {
            var hasMockups = result.mockupData && result.mockupData.count > 0;
            // Toujours normaliser en forward slashes (évite les problèmes d'échappement Windows)
            var safePath = result.path.replace(/\\/g, '/');

            // Stocker pour le bouton "Re-tester mockups"
            window._lastIdmlPath = safePath;
            window._lastOutputFolder = config.outputFolder.replace(/\\/g, '/');
            if (hasMockups) {
                var btnRerun = document.getElementById('btn-rerun-mockups');
                if (btnRerun) btnRerun.style.display = 'block';
            }

            // DEBUG: écrire un fichier debug.txt dans le dossier _temp/
            var debugLines = [];
            var fsDbg = require('fs');
            var tempDir = nodePath.join(config.outputFolder, '_temp');
            try { if (!fsDbg.existsSync(tempDir)) fsDbg.mkdirSync(tempDir); } catch(e) {}
            var dbgPath = nodePath.join(tempDir, 'debug-mockups.txt');
            var writeDebug = function(line) {
                debugLines.push(new Date().toISOString() + ' ' + line);
                try { fsDbg.writeFileSync(dbgPath, debugLines.join('\n') + '\n'); } catch(e) {}
            };
            writeDebug('=== DEBUG MOCKUPS ===');
            writeDebug('outputFolder: ' + config.outputFolder);
            writeDebug('extensionPath: ' + config.extensionPath);
            writeDebug('result.mockupData: ' + JSON.stringify(result.mockupData));
            writeDebug('hasMockups: ' + hasMockups);

            if (hasMockups) {
                // Trouver les logos pour CHAQUE variation (horizontal, vertical, icon, text, custom1-3)
                var fs = require('fs');
                var logoVariations = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
                var logoPaths = {};
                var preferred = ['svg', 'png', 'ai', 'pdf', 'jpg'];

                function findFirstLogo(varFolder) {
                    if (!fs.existsSync(varFolder)) return '';
                    var files = fs.readdirSync(varFolder);
                    var dirs = [varFolder];
                    for (var d = 0; d < files.length; d++) {
                        var sub = nodePath.join(varFolder, files[d]);
                        try { if (fs.statSync(sub).isDirectory()) dirs.push(sub); } catch(e) {}
                    }
                    for (var p = 0; p < preferred.length; p++) {
                        for (var di = 0; di < dirs.length; di++) {
                            var dirFiles = fs.readdirSync(dirs[di]);
                            for (var f = 0; f < dirFiles.length; f++) {
                                if (dirFiles[f].toLowerCase().endsWith('.' + preferred[p])) {
                                    return nodePath.join(dirs[di], dirFiles[f]);
                                }
                            }
                        }
                    }
                    return '';
                }

                for (var lv = 0; lv < logoVariations.length; lv++) {
                    var varName = logoVariations[lv];
                    var origDir = nodePath.join(config.outputFolder, varName, 'original');
                    var found = findFirstLogo(origDir);
                    if (found) logoPaths[varName] = found.replace(/\\/g, '/');
                }
                writeDebug('logoPaths: ' + JSON.stringify(logoPaths));

                // logoPath par défaut = horizontal (rétrocompatibilité)
                var logoPath = logoPaths.horizontal || logoPaths.vertical || logoPaths.icon || '';

                if (logoPath) {
                    writeDebug('→ calling processPhotoshopThenInDesign');
                    showStatus('Traitement des mockups Photoshop (' + result.mockupData.count + ')...', 'info');

                    // Couleurs de la marque pour les calques COLOR_N du PSD
                    var brandColors = [];
                    if (config.colors && config.colors.length > 0) {
                        for (var ci = 0; ci < config.colors.length; ci++) {
                            brandColors.push(config.colors[ci].original || config.colors[ci] || '');
                        }
                    }

                    var mockupData = {
                        mockups: result.mockupData.mockups.map(function (m) {
                            return { name: m.name, filename: m.filename, path: m.path.replace(/\\/g, '/') };
                        }),
                        logoPath: logoPath.replace(/\\/g, '/'),
                        logoPaths: logoPaths,
                        outputFolder: config.outputFolder.replace(/\\/g, '/'),
                        primaryColor: brandColors[0] || '',
                        brandColors: brandColors,
                        darkColor: config.monochromeColor || brandColors[0] || '#000000',
                        lightColor: config.monochromeLightColor || '#ffffff',
                        brandName: config.brandName || 'Logo'
                    };

                    // Plus de backslashes dans les données → JSON.stringify simple
                    // Seules les apostrophes doivent être échappées pour le wrapper de l'evalScript
                    var mockupDataStr = JSON.stringify(mockupData).replace(/'/g, "\\'");

                    csInterface.evalScript("processPhotoshopThenInDesign('" + safePath + "', '" + mockupDataStr + "')", function (res) {
                        try {
                            var r = JSON.parse(res);
                            if (r.success) {
                                showStatus('Présentation avec mockups ouverte dans InDesign : ' + result.filename, 'success');
                            } else {
                                showStatus('Présentation générée : ' + result.filename + ' (erreur mockups : ' + r.error + ')', 'success');
                            }
                        } catch (e) {
                            showStatus('Présentation générée : ' + result.filename, 'success');
                        }
                    });
                } else {
                    // No horizontal logo found → skip mockups, open InDesign directly
                    writeDebug('→ NO logoPath, skipping Photoshop, opening InDesign directly');
                    showStatus('Présentation InDesign générée, ouverture dans InDesign...', 'info');
                    csInterface.evalScript('openInInDesignAndProcess("' + safePath + '")', function (res) {
                        try {
                            var r = JSON.parse(res);
                            if (r.success) {
                                showStatus('Présentation ouverte dans InDesign : ' + result.filename, 'success');
                            } else {
                                showStatus('Présentation générée : ' + result.filename, 'success');
                            }
                        } catch (e) {
                            showStatus('Présentation générée : ' + result.filename, 'success');
                        }
                    });
                }
            } else {
                // No mockups → direct InDesign opening (existing flow)
                writeDebug('→ hasMockups=false, opening InDesign directly (no mockup processing)');
                showStatus('Présentation InDesign générée, ouverture dans InDesign...', 'info');
                csInterface.evalScript('openInInDesignAndProcess("' + safePath + '")', function (res) {
                    try {
                        var r = JSON.parse(res);
                        if (r.success) {
                            showStatus('Présentation ouverte dans InDesign : ' + result.filename, 'success');
                        } else {
                            showStatus('Présentation générée : ' + result.filename + ' (ouverture InDesign échouée : ' + r.error + ')', 'success');
                        }
                    } catch (e) {
                        showStatus('Présentation générée : ' + result.filename, 'success');
                    }
                });
            }
        } else {
            showStatus('Erreur présentation : ' + result.error, 'error');
        }
    } catch (err) {
        console.error('Presentation generation error:', err);
        showStatus('Erreur lors de la génération de la présentation : ' + (err.message || err), 'error');
    }
}

function handleRerunMockups() {
    var outputFolder = window._lastOutputFolder;
    var idmlPath = window._lastIdmlPath;
    if (!outputFolder || !idmlPath) {
        showStatus('Aucune génération précédente trouvée. Générez d\'abord la présentation.', 'error');
        return;
    }
    showStatus('Re-lancement mockups PS → InDesign...', 'info');
    csInterface.evalScript("rerunMockupsFromDisk('" + outputFolder + "', '" + idmlPath + "')", function (res) {
        try {
            var r = JSON.parse(res);
            if (r.success) {
                showStatus('Mockups relancés. Photoshop traite les PSD puis InDesign ouvrira.', 'success');
            } else {
                showStatus('Erreur re-run mockups : ' + r.error, 'error');
            }
        } catch (e) {
            showStatus('Re-run mockups envoyé.', 'success');
        }
    });
}

function resetSelections() {
  appState.selections = {
    horizontal: null,
    vertical: null,
    icon: null,
    text: null,
    custom1: null,
    custom2: null,
    custom3: null
  };
  ['horizontal','vertical','icon','text','custom1','custom2','custom3'].forEach(type => {
    const statusEl = document.getElementById(`status-${type}`);
    if (statusEl) {
      statusEl.textContent = 'Pas sélect';
      statusEl.classList.remove('selected');
    }
    const btnEl = document.querySelector(`.btn-select[data-type="${type}"]`);
    if (btnEl) btnEl.classList.remove('selected');
  });
  updateUI();
}

function getTypeName(type) {
  const names = {
    horizontal: 'Version horizontale',
    vertical:   'Version verticale',
    icon:       'Icône',
    text:       'Typographie'
  };

  // Pour les variations custom, récupérer le label personnalisé
  if (type.startsWith('custom')) {
    const labelInput = document.getElementById(`label-${type}`);
    if (labelInput && labelInput.value) {
      return labelInput.value;
    }
    return `Variation ${type.replace('custom', '')}`;
  }

  return names[type] || type;
}

function showExportDonePopup() {
    // Overlay popup simple
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    var popup = document.createElement('div');
    popup.style.cssText = 'background:var(--bg-color);border-radius:12px;padding:24px 32px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:280px;';
    popup.innerHTML = '<div style="font-size:32px;margin-bottom:12px;">&#10003;</div><p style="font-size:14px;font-weight:600;margin-bottom:16px;color:var(--text-color);">Exportation terminée !</p><button style="padding:8px 24px;background:var(--primary-color);border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;">OK</button>';
    popup.querySelector('button').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function showStatus(message, type = '') {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;

    // Créer le contenu avec le bouton de fermeture
    statusEl.innerHTML = `
        ${message}
        <button class="status-close" onclick="this.parentElement.style.display='none'" title="Fermer">×</button>
    `;

    statusEl.className = 'status-message';
    if (type) {
        statusEl.classList.add(type);
    }
    statusEl.style.display = 'block';

    console.log(`Status [${type}]: ${message}`);

    // Masquer après 5 secondes si succès (augmenté à 5s pour laisser le temps de lire)
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

/**
 * Liste des polices installées (remplie depuis Illustrator).
 */
var _fontFamilies = [];

/**
 * Charge la liste des polices installées depuis Illustrator
 * puis initialise l'autocomplétion custom sur les champs police.
 */
function loadFontList() {
    var script =
        'var f=app.textFonts,fam={},i;' +
        'for(i=0;i<f.length;i++)fam[f[i].family]=1;' +
        'var r=[];for(var k in fam)r.push(k);' +
        'r.sort();r.join("|")';

    csInterface.evalScript(script, function(result) {
        if (!result || result === 'EvalScript error.' || result === 'undefined') {
            console.warn('Impossible de charger les polices depuis Illustrator');
            return;
        }
        _fontFamilies = result.split('|').filter(function(f) { return f; });
        console.log(_fontFamilies.length + ' polices chargées');
        setupFontAutocomplete('brand-font-primary', 'font-dropdown-primary');
        setupFontAutocomplete('brand-font-secondary', 'font-dropdown-secondary');
    });
}

/**
 * Configure l'autocomplétion custom pour un champ police.
 */
function setupFontAutocomplete(inputId, dropdownId) {
    var input = document.getElementById(inputId);
    var dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    var activeIndex = -1;

    function showSuggestions() {
        var val = input.value.toLowerCase();
        dropdown.innerHTML = '';
        activeIndex = -1;

        var matches = _fontFamilies;
        if (val) {
            matches = _fontFamilies.filter(function(f) {
                return f.toLowerCase().indexOf(val) !== -1;
            });
        }

        if (matches.length === 0) {
            dropdown.classList.remove('visible');
            return;
        }

        // Limiter à 50 résultats pour la performance
        var limit = Math.min(matches.length, 50);
        for (var i = 0; i < limit; i++) {
            var item = document.createElement('div');
            item.className = 'font-dropdown-item';
            item.setAttribute('data-value', matches[i]);

            // Mettre en gras la partie qui correspond
            if (val) {
                var idx = matches[i].toLowerCase().indexOf(val);
                item.innerHTML =
                    escapeHtml(matches[i].substring(0, idx)) +
                    '<span class="font-match">' + escapeHtml(matches[i].substring(idx, idx + val.length)) + '</span>' +
                    escapeHtml(matches[i].substring(idx + val.length));
            } else {
                item.textContent = matches[i];
            }

            item.addEventListener('mousedown', function(e) {
                e.preventDefault(); // empêcher le blur de l'input
                input.value = this.getAttribute('data-value');
                dropdown.classList.remove('visible');
            });
            dropdown.appendChild(item);
        }
        dropdown.classList.add('visible');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    input.addEventListener('input', showSuggestions);
    input.addEventListener('focus', showSuggestions);

    input.addEventListener('blur', function() {
        // Petit délai pour laisser le mousedown se déclencher
        setTimeout(function() { dropdown.classList.remove('visible'); }, 150);
    });

    input.addEventListener('keydown', function(e) {
        var items = dropdown.querySelectorAll('.font-dropdown-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            updateActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            updateActive(items);
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            input.value = items[activeIndex].getAttribute('data-value');
            dropdown.classList.remove('visible');
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('visible');
        }
    });

    function updateActive(items) {
        for (var i = 0; i < items.length; i++) {
            items[i].classList.toggle('active', i === activeIndex);
        }
        if (activeIndex >= 0 && items[activeIndex]) {
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        }
    }
}

// Fonction utilitaire pour appeler ExtendScript avec timeout
function evalExtendScript(functionName, params = [], timeout = 30000) {
    return new Promise((resolve, reject) => {
        const script = params.length > 0
            ? `${functionName}(${params.map(p => JSON.stringify(p)).join(',')})`
            : `${functionName}()`;

        console.log('Calling ExtendScript:', script);

        let timeoutId = null;
        let completed = false;

        // Configurer le timeout (0 = pas de timeout)
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    console.error('ExtendScript timeout après', timeout, 'ms');
                    reject(new Error(`Timeout: L'opération a pris plus de ${timeout/1000}s`));
                }
            }, timeout);
        }

        csInterface.evalScript(script, (result) => {
            if (!completed) {
                completed = true;
                clearTimeout(timeoutId);

                console.log('ExtendScript result:', result);

                if (result === 'EvalScript error.') {
                    reject(new Error('ExtendScript execution failed'));
                } else {
                    resolve(result);
                }
            }
        });
    });
}

/**
 * Ouvre le sélecteur de couleur natif Illustrator via app.showColorPicker()
 * Affiche le dialogue natif avec onglets RGB/CMYK/HSB/Grayscale/Web Safe RGB
 * Permet l'utilisation de la pipette pour prélever des couleurs dans le document
 * @param {string} currentColor - Couleur actuelle en hex (ex: "#FF0000") à afficher dans le dialogue
 * @return {Promise<string|null>} Retourne la couleur hex (#RRGGBB) ou null si annulé/erreur
 */
async function openNativeColorPicker(currentColor = '#000000') {
    try {
        // Timeout long (120s) car le dialogue bloque ExtendScript tant que l'utilisateur choisit
        const result = await evalExtendScript('openColorPickerDialog', [currentColor], 120000);

        if (result === 'CANCELLED') {
            // L'utilisateur a annulé - ne rien faire
            console.log('Sélection de couleur annulée');
            return null;
        } else if (result && result.startsWith('COLOR:')) {
            // Extraire la couleur hex du format "COLOR:#RRGGBB"
            const hexColor = result.substring(6);
            console.log('Couleur sélectionnée:', hexColor);
            return hexColor;
        } else if (result && result.startsWith('ERROR:')) {
            const errorMsg = result.substring(7);
            console.error('Erreur sélecteur de couleur:', errorMsg);
            showStatus(`Erreur: ${errorMsg}`, 'error');
            return null;
        } else {
            console.error('Résultat inattendu du sélecteur:', result);
            showStatus('Erreur: résultat inattendu du sélecteur de couleur', 'error');
            return null;
        }
    } catch (error) {
        console.error('Erreur lors de l\'ouverture du sélecteur de couleur:', error);
        showStatus(`Erreur: ${error.message}`, 'error');
        return null;
    }
}

function updateExportFormats() {
  appState.exportFormats.png = document.getElementById('export-png').checked;
  appState.exportFormats.jpg = document.getElementById('export-jpg').checked;
  appState.exportFormats.svg = document.getElementById('export-svg').checked;
  appState.exportFormats.ai  = document.getElementById('export-ai').checked;
  appState.exportFormats.pdf = document.getElementById('export-pdf').checked;
  updateUI();
}

async function analyzeColors() {
  try {
    showStatus('Analyse des couleurs en cours...', 'warning');

    // ✨ NOUVEAU : Vérifier qu'au moins une variation est sélectionnée
    const hasSelection = Object.values(appState.selections).some(v => v);
    if (!hasSelection) {
      showStatus('Aucune variation sélectionnée. Sélectionnez au moins une variation (horizontal, vertical, icône, texte, etc.) pour analyser ses couleurs.', 'warning');
      return;
    }

    // ✨ NOUVEAU : Extraire les couleurs de TOUTES les variations stockées
    const result = await evalExtendScript('extractAllStoredColors');

    if (result && result.startsWith('COLORS:')) {
      const colorsJSON = result.substring(7);
      const data = JSON.parse(colorsJSON);
      const colors = data.colors;
      const analyzedCount = data.analyzed;

      if (colors.length === 0) {
        showStatus('Aucune couleur trouvée dans les variations sélectionnées', 'warning');
        return;
      }

      // Initialiser le mapping avec les couleurs extraites
      appState.customColors.mapping = colors.map(c => ({
        original: c,
        custom: c
      }));

      // Afficher les couleurs
      displayColorMapping();

      // Message amélioré indiquant le nombre de variations analysées
      const variationText = analyzedCount > 1 ? `${analyzedCount} variations` : '1 variation';
      showStatus(`${colors.length} couleur(s) détectée(s) sur ${variationText}. Vous pouvez maintenant les personnaliser ci-dessous.`, 'success');
    } else if (result && result.startsWith('ERROR:')) {
      const errorMsg = result.substring(7);
      showStatus(errorMsg, 'error');
    } else {
      showStatus('Impossible d\'analyser les couleurs. Vérifiez que vos variations contiennent des formes colorées.', 'error');
    }
  } catch (e) {
    console.error('Erreur analyse couleurs:', e);
    const errorMsg = e.message || 'Erreur inconnue';
    showStatus('Impossible d\'analyser les couleurs : ' + errorMsg, 'error');
  }
}

function displayColorMapping() {
  const container = document.getElementById('colors-mapping');
  if (!container) return;

  container.innerHTML = '';

  appState.customColors.mapping.forEach((colorMap, index) => {
    const item = document.createElement('div');
    item.className = 'color-mapping-item';

    // Couleur originale
    const originalPreview = document.createElement('div');
    originalPreview.className = 'color-preview';
    originalPreview.style.backgroundColor = colorMap.original;
    originalPreview.title = colorMap.original;

    const originalInfo = document.createElement('div');
    originalInfo.className = 'color-info';
    const originalLabel = document.createElement('div');
    originalLabel.className = 'color-label';
    originalLabel.textContent = 'Original';
    const originalValue = document.createElement('div');
    originalValue.className = 'color-value';
    originalValue.textContent = colorMap.original;
    originalInfo.appendChild(originalLabel);
    originalInfo.appendChild(originalValue);

    // Flèche
    const arrow = document.createElement('div');
    arrow.className = 'color-arrow';
    arrow.textContent = '→';

    // Couleur custom - bouton avec sélecteur natif Illustrator
    const customPreview = document.createElement('button');
    customPreview.type = 'button';
    customPreview.className = 'color-preview color-picker-btn';
    customPreview.style.backgroundColor = colorMap.custom;
    customPreview.title = 'Cliquer pour ouvrir le sélecteur de couleur natif Illustrator (avec pipette)';
    customPreview.addEventListener('click', async () => {
      // Passer la couleur actuelle au dialogue
      const selectedColor = await openNativeColorPicker(colorMap.custom);
      if (selectedColor) {
        appState.customColors.mapping[index].custom = selectedColor;
        customPreview.style.backgroundColor = selectedColor;
        customValue.textContent = selectedColor;
      }
    });

    const customInfo = document.createElement('div');
    customInfo.className = 'color-info';
    const customLabel = document.createElement('div');
    customLabel.className = 'color-label';
    customLabel.textContent = 'Custom';
    const customValue = document.createElement('div');
    customValue.className = 'color-value';
    customValue.textContent = colorMap.custom;
    customInfo.appendChild(customLabel);
    customInfo.appendChild(customValue);

    // Assembler
    item.appendChild(originalPreview);
    item.appendChild(originalInfo);
    item.appendChild(arrow);
    item.appendChild(customPreview);
    item.appendChild(customInfo);

    container.appendChild(item);
  });
}

async function browseFolder() {
  try {
    const folder = await evalExtendScript('selectExportFolder', [], 0);
    if (folder) {
      appState.outputFolder = folder;
      document.getElementById('output-folder').value = folder;
      showStatus(`Dossier de sortie : ${folder}`, 'success');
      updateUI();
    }
  } catch (e) {
    console.error('Erreur browseFolder:', e);
    const errorMsg = e.message || 'Erreur inconnue';
    showStatus('Impossible de choisir le dossier : ' + errorMsg, 'error');
  }
}

})(); // Fin de l'IIFE - Encapsulation du code