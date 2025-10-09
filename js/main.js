// Instance globale de CSInterface
let csInterface;

// État de l'application
const appState = {
  selections: { 
    horizontal: null,
    vertical: null,
    icon: null,
    text: null 
  },
  artboardTypes: {
    fit: true,
    square: true 
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
outputFolder: ''

};

// Initialisation
document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('Initializing Logo Déclinaisons...');

    try {
        csInterface = new CSInterface();
        setupEventListeners();
        updateTabNavigationButtons(); // Initialiser l'état des boutons de navigation
        updateUI();
        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Failed to initialize:', error);
        showStatus('Erreur d\'initialisation', 'error');
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

    // écouteur colorpicker monochromie
    const monochromeColorPicker = document.getElementById('black-color-picker');
      if (monochromeColorPicker) {
          monochromeColorPicker.addEventListener('input', (e) => {
              appState.colorVariations.monochromeColor = e.target.value;
              updateUI();
          });
    }

    // écouteur colorpicker monochromie light
    const monochromeLightColorPicker = document.getElementById('light-color-picker');
      if (monochromeLightColorPicker) {
          monochromeLightColorPicker.addEventListener('input', (e) => {
              appState.colorVariations.monochromeLightColor = e.target.value;
              updateUI();
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
    // Width / Height inputs
    const lockCheckbox = document.getElementById('lock-aspect-ratio');

    // Quand on modifie la largeur
    document.getElementById('custom-width').addEventListener('change', (e) => {
      const newWidth = parseInt(e.target.value, 10) || 1;
      if (appState.lockAspectRatio) {
        const ratio = appState.customSize.height / appState.customSize.width;
        const newHeight = Math.max(1, Math.round(newWidth * ratio));
        appState.customSize.width  = newWidth;
        appState.customSize.height = newHeight;
        document.getElementById('custom-height').value = newHeight;
      } else {
        appState.customSize.width = newWidth;
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
        const ratio = appState.customSize.width / appState.customSize.height;
        const newWidth = Math.max(1, Math.round(newHeight * ratio));
        appState.customSize.height = newHeight;
        appState.customSize.width  = newWidth;
        document.getElementById('custom-width').value = newWidth;
      } else {
        appState.customSize.height = newHeight;
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
    // Bouton générer
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

}

async function handleSelection(event) {
    const type = event.target.dataset.type;
    console.log('Handling selection for type:', type);
    
    try {
        // Vérifier qu'un document est ouvert
        const hasDoc = await evalExtendScript('hasOpenDocument');
        if (hasDoc === 'false') {
            showStatus('Veuillez ouvrir un document Illustrator', 'error');
            return;
        }
        
        // Vérifier la sélection
        const selectionInfo = await evalExtendScript('getSelectionInfo');
        if (selectionInfo === 'NO_SELECTION') {
            showStatus('Veuillez sélectionner un élément', 'warning');
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
        } else {
            showStatus('Erreur lors de la sélection', 'error');
        }
        
    } catch (error) {
        console.error('Selection error:', error);
        showStatus('Erreur lors de la sélection', 'error');
    }
}

function updateArtboardTypes() {
    const fitCheckbox = document.getElementById('artboard-fit');
    const squareCheckbox = document.getElementById('artboard-square');
    
    appState.artboardTypes.fit = fitCheckbox ? fitCheckbox.checked : true;
    appState.artboardTypes.square = squareCheckbox ? squareCheckbox.checked : true;
    
    updateUI();
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

// La fonction updateSizes() et les listeners associés ont été supprimés

function updateUI() {
  // Calcul des tailles d'export
  const fixedCount = Object.values(appState.exportSizes).filter(v => v).length;
  const customCount = appState.customSizeEnabled ? 1 : 0;
  const sizeCount  = fixedCount + customCount;

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
    try {
        showStatus('Génération en cours...', 'warning');

        // Préparer les paramètres
        const params = {
        selections: appState.selections,
        artboardTypes: appState.artboardTypes,
        colorVariations: appState.colorVariations,
        customColors: appState.customColors, // Nouveau: mapping des couleurs customs
        exportFormats: appState.exportFormats,
        exportSizes: appState.exportSizes,
        customSizeEnabled: appState.customSizeEnabled,
        customSize: appState.customSize,
        outputFolder: appState.outputFolder
        };

        console.log('Generate params:', params);

        // Appeler la fonction de génération
        const result = await evalExtendScript('generateArtboards', [JSON.stringify(params)]);

        if (result && result.startsWith('SUCCESS')) {
            const count = result.split(':')[1];
            showStatus(`${count} plans de travail créés avec succès !`, 'success');

            // Réinitialiser les sélections
            resetSelections();
        } else if (result && result.startsWith('ERROR')) {
            const errorMsg = result.split(':')[1] || 'Erreur inconnue';
            showStatus(`Erreur: ${errorMsg}`, 'error');
        } else {
            showStatus('Erreur lors de la génération', 'error');
        }

    } catch (error) {
        console.error('Generate error:', error);
        showStatus('Erreur lors de la génération: ' + error.message, 'error');
    }
}

function resetSelections() {
  appState.selections = {
    horizontal: null,
    vertical: null,
    icon: null,
    text: null
  };
  ['horizontal','vertical','icon','text'].forEach(type => {
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
  return names[type] || type;
}

function showStatus(message, type = '') {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = 'status-message';
    if (type) {
        statusEl.classList.add(type);
    }
    statusEl.style.display = 'block';
    
    console.log(`Status [${type}]: ${message}`);
    
    // Masquer après 3 secondes si succès
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Fonction utilitaire pour appeler ExtendScript
function evalExtendScript(functionName, params = []) {
    return new Promise((resolve, reject) => {
        const script = params.length > 0 
            ? `${functionName}(${params.map(p => JSON.stringify(p)).join(',')})`
            : `${functionName}()`;
            
        console.log('Calling ExtendScript:', script);
        
        csInterface.evalScript(script, (result) => {
            console.log('ExtendScript result:', result);
            
            if (result === 'EvalScript error.') {
                reject(new Error('ExtendScript execution failed'));
            } else {
                resolve(result);
            }
        });
    });
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

    // Vérifier qu'un élément est sélectionné
    const selectionInfo = await evalExtendScript('getSelectionInfo');
    if (selectionInfo === 'NO_SELECTION') {
      showStatus('Veuillez sélectionner un élément pour analyser ses couleurs', 'warning');
      return;
    }

    // Extraire les couleurs de la sélection
    const result = await evalExtendScript('extractColors');

    if (result && result.startsWith('COLORS:')) {
      const colorsJSON = result.substring(7);
      const colors = JSON.parse(colorsJSON);

      if (colors.length === 0) {
        showStatus('Aucune couleur trouvée dans la sélection', 'warning');
        return;
      }

      // Initialiser le mapping avec les couleurs extraites
      appState.customColors.mapping = colors.map(c => ({
        original: c,
        custom: c
      }));

      // Afficher les couleurs
      displayColorMapping();
      showStatus(`${colors.length} couleur(s) détectée(s)`, 'success');
    } else if (result && result.startsWith('ERROR:')) {
      const errorMsg = result.substring(7);
      showStatus('Erreur: ' + errorMsg, 'error');
    } else {
      showStatus('Erreur lors de l\'analyse des couleurs', 'error');
    }
  } catch (e) {
    showStatus('Erreur lors de l\'analyse des couleurs: ' + e.message, 'error');
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

    // Couleur custom
    const customPreview = document.createElement('input');
    customPreview.type = 'color';
    customPreview.className = 'color-preview';
    customPreview.value = colorMap.custom;
    customPreview.addEventListener('change', (e) => {
      appState.customColors.mapping[index].custom = e.target.value;
      customValue.textContent = e.target.value;
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
    console.error(e);
    showStatus('Erreur lors du choix du dossier', 'error');
  }
}