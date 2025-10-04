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
    black: false,
    blackColor: '#000000'
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

function setupEventListeners() {
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

    // écouteur colorpicker
    const blackColorPicker = document.getElementById('black-color-picker');
      if (blackColorPicker) {
          blackColorPicker.addEventListener('input', (e) => {
              appState.colorVariations.blackColor = e.target.value;
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
    const blackCheckbox = document.getElementById('color-black'); // Nouvelle checkbox pour noir
    if (blackCheckbox) {
        blackCheckbox.addEventListener('change', updateColorVariations);
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
    const blackCheckbox = document.getElementById('color-black');
    appState.colorVariations.black = blackCheckbox ? blackCheckbox.checked : false; // Mise à jour pour la nouvelle option
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
  const totalArtboards = selectedCount * typeCount * colorCount;

  // Mise à jour du résumé et du bouton
  const summaryEl = document.getElementById('summary');
  const countEl   = document.getElementById('artboard-count');
  
  if (totalArtboards > 0) {
    summaryEl.style.display = 'block';
    countEl.textContent = totalArtboards;
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
        colorVariations: appState.colorVariations, // Inclut maintenant black
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