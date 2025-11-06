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
        csInterface = new CSInterface();

        // Initialiser le système de trial/licensing
        await initTrialSystem();

        setupEventListeners();
        updateTabNavigationButtons(); // Initialiser l'état des boutons de navigation
        updateUI();
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
        // License activée → afficher badge vert
        badge.style.display = 'block';
        badge.className = 'trial-badge';

        if (status.offline) {
            text.textContent = '✅ License activée (Mode offline)';
        } else {
            text.textContent = '✅ License activée';
        }
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
            <input type="text" id="label-${variationId}" placeholder="Nom de la variation"
                   value="Variation ${appState.customVariationsCount}"
                   style="border: none; background: transparent; font-weight: bold; width: 150px;">
        </label>
        <div class="selection-controls">
            <span class="selection-status" id="status-${variationId}">Non sélectionné</span>
            <button class="btn-select" data-type="${variationId}">Sélectionner</button>
            <button class="btn-remove" data-variation="${variationId}" style="margin-left: 0.5em; padding: 0.3em 0.7em; background: #d9534f; color: white; border: none; border-radius: 3px; cursor: pointer;">✕</button>
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
    const infoDiv = document.getElementById('add-variation-info');

    if (addBtn) {
        addBtn.disabled = appState.customVariationsCount >= 3;
    }

    if (infoDiv) {
        infoDiv.textContent = `${appState.customVariationsCount}/3 variations ajoutées`;
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

    // Bouton générer
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
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

  // Activer le bouton seulement si tous les critères sont remplis
  document.getElementById('generate-btn').disabled = !(selectedCount > 0 && typeCount > 0 && sizeCount > 0 && colorCount > 0);
}

async function handleGenerate() {
    const generateBtn = document.getElementById('generate-btn');

    try {
        // 🔒 VÉRIFIER LE TRIAL AVANT GÉNÉRATION
        const canGenerate = await Trial.canGenerate();

        if (!canGenerate.allowed) {
            // Trial épuisé → Bloquer et afficher message
            showStatus(canGenerate.message, 'error');
            console.log('❌ Génération bloquée:', canGenerate.reason);
            return; // Arrêter ici
        }

        console.log('✓ Génération autorisée:', canGenerate.reason);

        // Désactiver le bouton pendant la génération
        if (generateBtn) generateBtn.disabled = true;

        showStatus('Génération en cours...', 'warning');

        // Préparer les paramètres
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

        console.log('Generate params:', params);

        // Appeler la fonction de génération avec timeout étendu (2 minutes pour grandes générations)
        const result = await evalExtendScript('generateArtboards', [JSON.stringify(params)], 120000);

        if (result && result.startsWith('SUCCESS')) {
            const count = result.split(':')[1];
            let successMsg = `${count} plans de travail créés avec succès !`;

            // Ajouter info sur l'enregistrement si un dossier d'export est défini
            if (appState.outputFolder && appState.outputFolder !== '') {
                successMsg += ' Fichier Illustrator enregistré : logo-export-variation.ai';
            }

            showStatus(successMsg, 'success');

            // 🎁 INCRÉMENTER LE COMPTEUR DE TRIAL (si en mode trial)
            try {
                await Trial.incrementGeneration();

                // Mettre à jour le badge avec le nouveau statut
                const newStatus = await Trial.getStatus();
                updateTrialBadge(newStatus);
            } catch (incrementError) {
                // Erreur lors de l'incrémentation (serveur offline pour trial)
                console.error('❌ Erreur incrémentation trial:', incrementError);
                showStatus('⚠️ Génération réussie mais impossible de mettre à jour le compteur (connexion requise)', 'warning');
            }

            // Réinitialiser les sélections
            resetSelections();
        } else if (result && result.startsWith('ERROR')) {
            const errorMsg = result.substring(6).trim();
            if (!errorMsg) {
                showStatus('Erreur inconnue lors de la génération', 'error');
            } else {
                showStatus(errorMsg, 'error');
            }
        } else {
            showStatus('Erreur: Réponse invalide du serveur ExtendScript', 'error');
        }

    } catch (error) {
        console.error('Generate error:', error);
        const errorMsg = error.message || 'Erreur inconnue';
        showStatus(`Erreur lors de la génération: ${errorMsg}`, 'error');
    } finally {
        // Réactiver le bouton
        if (generateBtn) generateBtn.disabled = false;
        updateUI(); // Re-vérifier l'état du bouton
    }
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
      statusEl.textContent = 'Non sélectionné';
      statusEl.classList.remove('selected');
    }
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

// Fonction utilitaire pour appeler ExtendScript avec timeout
function evalExtendScript(functionName, params = [], timeout = 30000) {
    return new Promise((resolve, reject) => {
        const script = params.length > 0
            ? `${functionName}(${params.map(p => JSON.stringify(p)).join(',')})`
            : `${functionName}()`;

        console.log('Calling ExtendScript:', script);

        let timeoutId = null;
        let completed = false;

        // Configurer le timeout
        timeoutId = setTimeout(() => {
            if (!completed) {
                completed = true;
                console.error('ExtendScript timeout après', timeout, 'ms');
                reject(new Error(`Timeout: L'opération a pris plus de ${timeout/1000}s`));
            }
        }, timeout);

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
        // Passer la couleur actuelle au dialogue pour l'afficher
        const result = await evalExtendScript('openColorPickerDialog', [currentColor]);

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
    const folder = await evalExtendScript('selectExportFolder');
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