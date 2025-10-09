/**
 * Logo Déclinaisons - ExtendScript
 * Code côté Illustrator
 */

var storedSelections = {
    horizontal: null,
    vertical: null,
    icon: null,
    text: null
};

/**
 * Constantes pour les limites d'Illustrator
 */
var ILLUSTRATOR_MAX_CANVAS = 16383; // Points (227 inches)
var ILLUSTRATOR_MIN_CANVAS = -16383;

/**
 * Valide qu'un élément est utilisable pour la génération
 * @param {PageItem} item - L'élément à valider
 * @return {Object} {valid: boolean, error: string}
 */
function validateElement(item) {
    if (!item) {
        return {valid: false, error: "Élément inexistant"};
    }

    if (!item.typename) {
        return {valid: false, error: "Type d'élément invalide"};
    }

    if (item.locked) {
        return {valid: false, error: "Élément verrouillé"};
    }

    try {
        var bounds = item.visibleBounds;
        var width = bounds[2] - bounds[0];
        var height = bounds[1] - bounds[3];

        if (width <= 0 || height <= 0) {
            return {valid: false, error: "Dimensions invalides (L:" + width.toFixed(1) + ", H:" + height.toFixed(1) + ")"};
        }

        if (width > 20000 || height > 20000) {
            return {valid: false, error: "Élément trop grand (max 20000px)"};
        }

        // ✨ NOUVEAU: Vérifier que les bounds ne sont pas à des positions extrêmes
        var left = bounds[0];
        var top = bounds[1];
        var right = bounds[2];
        var bottom = bounds[3];

        // Si les bounds sont très éloignés du centre, avertir
        var maxCoord = 50000; // Limite raisonnable pour éviter problèmes
        if (Math.abs(left) > maxCoord || Math.abs(top) > maxCoord ||
            Math.abs(right) > maxCoord || Math.abs(bottom) > maxCoord) {
            $.writeln("⚠️ Élément a des coordonnées extrêmes: L=" + left.toFixed(0) + ", T=" + top.toFixed(0) + ", R=" + right.toFixed(0) + ", B=" + bottom.toFixed(0));
            $.writeln("   L'élément sera repositionné pour éviter des erreurs");
        }

    } catch (e) {
        return {valid: false, error: "Erreur lecture dimensions: " + e.toString()};
    }

    return {valid: true, error: ""};
}

/**
 * Valide et corrige les dimensions d'un rectangle d'artboard
 * @param {Array} rect - [left, top, right, bottom]
 * @return {Object} {valid: boolean, rect: Array, error: string}
 */
function validateArtboardRect(rect) {
    var left = rect[0];
    var top = rect[1];
    var right = rect[2];
    var bottom = rect[3];

    // Vérifier que top > bottom (Illustrator coordinate system)
    if (top <= bottom) {
        return {valid: false, rect: rect, error: "Hauteur invalide (top:" + top.toFixed(1) + " <= bottom:" + bottom.toFixed(1) + ")"};
    }

    // Vérifier que right > left
    if (right <= left) {
        return {valid: false, rect: rect, error: "Largeur invalide (right:" + right.toFixed(1) + " <= left:" + left.toFixed(1) + ")"};
    }

    var width = right - left;
    var height = top - bottom;

    // Dimensions minimum
    if (width < 1 || height < 1) {
        return {valid: false, rect: rect, error: "Artboard trop petit (min 1pt)"};
    }

    // Dimensions maximum
    if (width > 16383 || height > 16383) {
        return {valid: false, rect: rect, error: "Artboard trop grand (max 16383pt / 227 inches)"};
    }

    // Vérifier limites canvas Illustrator
    if (left < ILLUSTRATOR_MIN_CANVAS || right > ILLUSTRATOR_MAX_CANVAS ||
        bottom < ILLUSTRATOR_MIN_CANVAS || top > ILLUSTRATOR_MAX_CANVAS) {

        // Essayer de recadrer dans les limites
        left = Math.max(ILLUSTRATOR_MIN_CANVAS, Math.min(left, ILLUSTRATOR_MAX_CANVAS - width));
        right = left + width;
        top = Math.min(ILLUSTRATOR_MAX_CANVAS, Math.max(top, ILLUSTRATOR_MIN_CANVAS + height));
        bottom = top - height;

        $.writeln("⚠️ Artboard recadré dans les limites du canvas");
    }

    return {valid: true, rect: [left, top, right, bottom], error: ""};
}

// Vérifier si un document est ouvert
function hasOpenDocument() {
    try {
        return String(app.documents.length > 0);
    } catch (e) {
        return "false";
    }
}

// Obtenir des informations sur la sélection actuelle
function getSelectionInfo() {
    try {
        if (app.documents.length === 0) {
            return "NO_DOCUMENT";
        }
        
        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) {
            return "NO_SELECTION";
        }
        
        return "SELECTION_OK";
    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

// Stocker la sélection actuelle
function storeSelection(type) {
    try {
        if (app.documents.length === 0) {
            return "NO_DOCUMENT";
        }

        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) {
            return "NO_SELECTION";
        }

        var selection = doc.selection[0];
        var elementToStore;

        if (doc.selection.length > 1) {
            elementToStore = doc.groupItems.add();
            for (var i = doc.selection.length - 1; i >= 0; i--) {
                doc.selection[i].move(elementToStore, ElementPlacement.PLACEATBEGINNING);
            }
        } else {
            elementToStore = selection.duplicate();
        }

        // ✨ VALIDATION de l'élément avant stockage
        var validation = validateElement(elementToStore);
        if (!validation.valid) {
            try { elementToStore.remove(); } catch(e) {}
            return "ERROR: " + validation.error;
        }

        elementToStore.hidden = true;

        // Nettoyer l'ancienne sélection si elle existe
        if (storedSelections[type]) {
            try {
                storedSelections[type].remove();
                $.writeln("✓ Ancienne sélection '" + type + "' supprimée");
            } catch (e) {
                $.writeln("⚠️ Erreur suppression ancienne sélection '" + type + "': " + e.toString());
            }
        }

        storedSelections[type] = elementToStore;
        $.writeln("✓ Sélection '" + type + "' stockée avec succès");

        return "OK";
    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

// Fonction utilitaire : convertir RGBColor en hexadécimal
function rgbToHex(rgbColor) {
    var r = Math.round(rgbColor.red);
    var g = Math.round(rgbColor.green);
    var b = Math.round(rgbColor.blue);

    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }

    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// Extraire les couleurs de la sélection actuelle
function extractColors() {
    try {
        if (app.documents.length === 0) {
            return "ERROR: NO_DOCUMENT";
        }

        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) {
            return "ERROR: NO_SELECTION";
        }

        var colorSet = {};
        var maxColors = 10;
        var colorCount = 0;

        // Parcourir tous les éléments sélectionnés
        for (var i = 0; i < doc.selection.length; i++) {
            colorCount = extractColorsRecursive(doc.selection[i], colorSet, colorCount);
            if (colorCount >= maxColors) break;
        }

        // Convertir en tableau et limiter à 10 couleurs
        var colors = [];
        var count = 0;
        for (var hex in colorSet) {
            if (colorSet.hasOwnProperty(hex)) {
                colors.push(hex);
                count++;
                if (count >= maxColors) break;
            }
        }

        // Créer manuellement le JSON (ExtendScript n'a pas JSON.stringify)
        var jsonString = '[';
        for (var i = 0; i < colors.length; i++) {
            if (i > 0) jsonString += ',';
            jsonString += '"' + colors[i] + '"';
        }
        jsonString += ']';

        return "COLORS:" + jsonString;
    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

function extractColorsRecursive(item, colorSet, colorCount) {
    if (colorCount >= 10) return colorCount;

    try {
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                colorCount = extractColorsRecursive(item.pageItems[i], colorSet, colorCount);
                if (colorCount >= 10) break;
            }
        } else if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) {
                colorCount = extractColorsRecursive(item.pathItems[i], colorSet, colorCount);
                if (colorCount >= 10) break;
            }
        } else if (item.typename === "PathItem") {
            if (item.filled && item.fillColor.typename === "RGBColor") {
                var hex = rgbToHex(item.fillColor);
                if (!colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }
            if (colorCount < 10 && item.stroked && item.strokeColor.typename === "RGBColor") {
                var hex = rgbToHex(item.strokeColor);
                if (!colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }
        } else if (item.typename === "TextFrame") {
            var textRange = item.textRange;
            if (textRange.characterAttributes.fillColor &&
                textRange.characterAttributes.fillColor.typename === "RGBColor") {
                var hex = rgbToHex(textRange.characterAttributes.fillColor);
                if (!colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }
            if (colorCount < 10 && textRange.characterAttributes.strokeColor &&
                textRange.characterAttributes.strokeColor.typename === "RGBColor") {
                var hex = rgbToHex(textRange.characterAttributes.strokeColor);
                if (!colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }
        } else if (item.pageItems && item.pageItems.length > 0) {
            for (var i = 0; i < item.pageItems.length; i++) {
                colorCount = extractColorsRecursive(item.pageItems[i], colorSet, colorCount);
                if (colorCount >= 10) break;
            }
        }
    } catch (e) {
        // Erreur silencieuse pour éviter de bloquer le traitement
    }

    return colorCount;
}

function selectExportFolder() {
    var folder = Folder.selectDialog("Choisir le dossier de sortie");
    return folder ? folder.fsName : "";
}

function hexToRGB(hex) {
    if (hex.charAt(0) === '#') hex = hex.substring(1);
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

function convertToMonochrome(element, rgbColor, tmpPaths) {
    try {
        var color = new RGBColor();
        color.red = rgbColor.r;
        color.green = rgbColor.g;
        color.blue = rgbColor.b;

        applyColorRecursive(element, color, tmpPaths);
        return true;
    } catch (e) {
         $.writeln("Erreur dans convertToMonochrome : " + e.toString());
        return false;
    }
}

function applyColorRecursive(item, color, tmpPaths) {

    if (item.typename === "GroupItem") {
        for (var i = 0; i < item.pageItems.length; i++) {
            applyColorRecursive(item.pageItems[i], color, tmpPaths);
        }
    } else if (item.typename === "CompoundPathItem") {
        if (item.pathItems.length === 0) {
            var tmp = item.pathItems.add();
            tmpPaths.push(tmp);
        }

        for (var i = 0; i < item.pathItems.length; i++) {
            applyColorRecursive(item.pathItems[i], color, tmpPaths);
        }
        return;
    } else if (item.typename === "PathItem") {
        if (!item.filled && item.pathPoints.length > 0) {
            item.filled = true;
        }
        if (item.filled) item.fillColor = color;
        if (item.stroked) item.strokeColor = color;
    } else if (item.typename === "TextFrame") {
        var textRange = item.textRange;
        if (textRange.characterAttributes.fillColor) {
            textRange.characterAttributes.fillColor = color;
        }
        if (textRange.characterAttributes.strokeColor) {
            textRange.characterAttributes.strokeColor = color;
        }
    } else if (item.pageItems && item.pageItems.length > 0) {
        for (var i = 0; i < item.pageItems.length; i++) {
            applyColorRecursive(item.pageItems[i], color, tmpPaths);
        }
    } else {
        // ✨ CORRECTION: Remplacer alert() par $.writeln()
        $.writeln("⚠️ Type non géré dans applyColorRecursive: " + item.typename);
    }
}

// Appliquer un mapping de couleurs personnalisé à un élément
function applyCustomColors(element, colorMapping) {
    try {
        applyCustomColorsRecursive(element, colorMapping);
        return true;
    } catch (e) {
        $.writeln("Erreur dans applyCustomColors : " + e.toString());
        return false;
    }
}

function applyCustomColorsRecursive(item, colorMapping) {
    try {
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                applyCustomColorsRecursive(item.pageItems[i], colorMapping);
            }
        } else if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) {
                applyCustomColorsRecursive(item.pathItems[i], colorMapping);
            }
        } else if (item.typename === "PathItem") {
            if (item.filled && item.fillColor.typename === "RGBColor") {
                var hex = rgbToHex(item.fillColor);
                var newHex = findCustomColor(hex, colorMapping);
                if (newHex && newHex !== hex) {
                    item.fillColor = hexToRGBColor(newHex);
                }
            }
            if (item.stroked && item.strokeColor.typename === "RGBColor") {
                var hex = rgbToHex(item.strokeColor);
                var newHex = findCustomColor(hex, colorMapping);
                if (newHex && newHex !== hex) {
                    item.strokeColor = hexToRGBColor(newHex);
                }
            }
        } else if (item.typename === "TextFrame") {
            var textRange = item.textRange;
            if (textRange.characterAttributes.fillColor &&
                textRange.characterAttributes.fillColor.typename === "RGBColor") {
                var hex = rgbToHex(textRange.characterAttributes.fillColor);
                var newHex = findCustomColor(hex, colorMapping);
                if (newHex && newHex !== hex) {
                    textRange.characterAttributes.fillColor = hexToRGBColor(newHex);
                }
            }
            if (textRange.characterAttributes.strokeColor &&
                textRange.characterAttributes.strokeColor.typename === "RGBColor") {
                var hex = rgbToHex(textRange.characterAttributes.strokeColor);
                var newHex = findCustomColor(hex, colorMapping);
                if (newHex && newHex !== hex) {
                    textRange.characterAttributes.strokeColor = hexToRGBColor(newHex);
                }
            }
        } else if (item.pageItems && item.pageItems.length > 0) {
            for (var i = 0; i < item.pageItems.length; i++) {
                applyCustomColorsRecursive(item.pageItems[i], colorMapping);
            }
        }
    } catch (e) {
        $.writeln("Erreur applyCustomColorsRecursive: " + e.toString());
    }
}

function findCustomColor(originalHex, colorMapping) {
    for (var i = 0; i < colorMapping.length; i++) {
        if (colorMapping[i].original.toLowerCase() === originalHex.toLowerCase()) {
            return colorMapping[i].custom;
        }
    }
    return originalHex; // Si pas de mapping trouvé, retourner la couleur originale
}

function hexToRGBColor(hex) {
    var rgb = hexToRGB(hex);
    var color = new RGBColor();
    color.red = rgb.r;
    color.green = rgb.g;
    color.blue = rgb.b;
    return color;
}


// Convertir un élément en niveaux de gris
function convertToGrayscale(element) {
    try {
        var originalSelection = app.activeDocument.selection;
        app.activeDocument.selection = [element];
        app.executeMenuCommand("Colors7"); // Utilisation de la commande native pour convertir en niveaux de gris
        app.activeDocument.selection = originalSelection;
        return true;
    } catch (e) {
        $.writeln("Erreur dans convertToGrayscale : " + e.toString());
        return false;
    }
}

// Générer les artboards
function generateArtboards(paramsJSON) {
    try {
        var params = eval('(' + paramsJSON + ')');
        if (!params || !params.selections) {
            return "ERROR: Paramètres invalides";
        }

        if (params.exportFormats) {
            var anyFmt = params.exportFormats.png || params.exportFormats.jpg || params.exportFormats.svg || params.exportFormats.ai || params.exportFormats.pdf;
            if (anyFmt && (!params.outputFolder || params.outputFolder === "")) {
                return "ERROR: Dossier de sortie non défini";
            }
        }

        var doc = app.activeDocument;
        var artboardCount = 0;
        var currentX = 0;
        var currentY = 0;
        var spacing = 50; // Réduit de 100 à 50
        var maxHeight = 0;
        var created = [];
        var artboardsPerRow = 4;

        // Réduire la taille des artboards pour éviter le débordement
        var artboardSize = 600; // Réduit de 1000 à 600

        var typesList = ['horizontal', 'vertical', 'icon', 'text'];

        // ✨ VALIDATION des sélections stockées
        for (var i = 0; i < typesList.length; i++) {
            var selType = typesList[i];
            if (params.selections[selType] && storedSelections[selType]) {
                var validation = validateElement(storedSelections[selType]);
                if (!validation.valid) {
                    $.writeln("⚠️ Sélection '" + selType + "' invalide: " + validation.error);
                    return "ERROR: Sélection '" + selType + "' invalide: " + validation.error;
                }
            }
        }

        var colorVariations = [];

        if (params.colorVariations.original) {
            colorVariations.push({ name: "original", suffix: "" });
        }
        if (params.colorVariations.blackwhite) {
            colorVariations.push({ name: "blackwhite", suffix: "_nb" });
        }
        if (params.colorVariations.monochrome) {
            colorVariations.push({
                name: "monochrome",
                suffix: "_monochrome",
                rgb: hexToRGB(params.colorVariations.monochromeColor || "#000000")
            });
        }
        if (params.colorVariations.monochromeLight) {
            colorVariations.push({
                name: "monochromeLight",
                suffix: "_monochromeLight",
                rgb: hexToRGB(params.colorVariations.monochromeLightColor || "#ffffff"),
                needsBlackBg: true
            });
        }
        if (params.colorVariations.custom && params.customColors && params.customColors.mapping && params.customColors.mapping.length > 0) {
            colorVariations.push({
                name: "custom",
                suffix: "_custom",
                mapping: params.customColors.mapping
            });
        }

        for (var i = 0; i < typesList.length; i++) {
            var selType = typesList[i];
            if (!params.selections[selType] || !storedSelections[selType]) continue;

            for (var c = 0; c < colorVariations.length; c++) {
                var colorVar = colorVariations[c];
                var element = storedSelections[selType].duplicate();
                element.hidden = false;

                if (colorVar.name === "blackwhite") {
                    convertToGrayscale(element);
                } else if (colorVar.name === "monochrome") {
                    var tmpPaths = [];
                    convertToMonochrome(element, colorVar.rgb, tmpPaths);
                    for (var j = tmpPaths.length - 1; j >= 0; j--) {
                        try {
                            tmpPaths[j].remove();
                        } catch (e) {}
                    }
                } else if (colorVar.name === "monochromeLight") {
                    var tmpPaths = [];
                    convertToMonochrome(element, colorVar.rgb, tmpPaths);
                    for (var j = tmpPaths.length - 1; j >= 0; j--) {
                        try {
                            tmpPaths[j].remove();
                        } catch (e) {}
                    }
                } else if (colorVar.name === "custom") {
                    applyCustomColors(element, colorVar.mapping);
                }

                if (params.artboardTypes.fit) {
                    try {
                        var nameFit = selType + "_fit" + colorVar.suffix;
                        var h = createFitArtboard(doc, element, artboardSize, currentX, currentY, nameFit, false);
                        maxHeight = Math.max(maxHeight, h);
                        artboardCount++;
                        created.push({ name: nameFit, type: selType, colorVariation: colorVar.name });

                        if (artboardCount % artboardsPerRow === 0) {
                            currentY -= (maxHeight + spacing);
                            currentX = 0;
                            maxHeight = 0;

                            // ✨ PROTECTION: Vérifier qu'on ne dépasse pas les limites du canvas
                            if (currentY - artboardSize < ILLUSTRATOR_MIN_CANVAS) {
                                $.writeln("⚠️ Limite canvas atteinte, arrêt de la génération (trop d'artboards)");
                                element.remove();
                                cleanupHiddenElements();
                                return "ERROR: Trop d'artboards - Limite canvas atteinte. Réduisez le nombre de variations.";
                            }
                        } else {
                            currentX += artboardSize + spacing;
                        }

                        // Si monochromeLight, créer une version avec fond noir
                        if (colorVar.needsBlackBg) {
                            var nameFitBg = selType + "_fit" + colorVar.suffix + "_bg";
                            var hBg = createFitArtboard(doc, element, artboardSize, currentX, currentY, nameFitBg, true);
                            maxHeight = Math.max(maxHeight, hBg);
                            artboardCount++;
                            created.push({ name: nameFitBg, type: selType, colorVariation: colorVar.name });

                            if (artboardCount % artboardsPerRow === 0) {
                                currentY -= (maxHeight + spacing);
                                currentX = 0;
                                maxHeight = 0;
                            } else {
                                currentX += artboardSize + spacing;
                            }
                        }
                    } catch (e) {
                        $.writeln("Erreur fit: " + e.toString());
                    }
                }

                if (params.artboardTypes.square) {
                    try {
                        var nameSq = selType + "_square" + colorVar.suffix;
                        createSquareArtboard(doc, element, artboardSize, currentX, currentY, nameSq, false);
                        maxHeight = Math.max(maxHeight, artboardSize);
                        artboardCount++;
                        created.push({ name: nameSq, type: selType, colorVariation: colorVar.name });

                        if (artboardCount % artboardsPerRow === 0) {
                            currentY -= (maxHeight + spacing);
                            currentX = 0;
                            maxHeight = 0;

                            // ✨ PROTECTION: Vérifier qu'on ne dépasse pas les limites du canvas
                            if (currentY - artboardSize < ILLUSTRATOR_MIN_CANVAS) {
                                $.writeln("⚠️ Limite canvas atteinte, arrêt de la génération (trop d'artboards)");
                                element.remove();
                                cleanupHiddenElements();
                                return "ERROR: Trop d'artboards - Limite canvas atteinte. Réduisez le nombre de variations.";
                            }
                        } else {
                            currentX += artboardSize + spacing;
                        }

                        // Si monochromeLight, créer une version avec fond noir
                        if (colorVar.needsBlackBg) {
                            var nameSqBg = selType + "_square" + colorVar.suffix + "_bg";
                            createSquareArtboard(doc, element, artboardSize, currentX, currentY, nameSqBg, true);
                            maxHeight = Math.max(maxHeight, artboardSize);
                            artboardCount++;
                            created.push({ name: nameSqBg, type: selType, colorVariation: colorVar.name });

                            if (artboardCount % artboardsPerRow === 0) {
                                currentY -= (maxHeight + spacing);
                                currentX = 0;
                                maxHeight = 0;
                            } else {
                                currentX += artboardSize + spacing;
                            }
                        }
                    } catch (e) {
                        $.writeln("Erreur square: " + e.toString());
                    }
                }

                element.remove();
            }
        }

        // ✨ NETTOYAGE GARANTI
        cleanupHiddenElements();

        if (params.exportFormats && params.exportSizes) {
            var rootPath = params.outputFolder;
            var activeSizes = [];
            for (var size in params.exportSizes) {
                if (params.exportSizes[size]) {
                    activeSizes.push({
                        size: parseInt(size),
                        prefix: size === "1000" ? "petit_" : size === "2000" ? "moyen_" : "grand_"
                    });
                }
            }

            for (var i = 0; i < created.length; i++) {
                var art = created[i];
                var typeFolder = new Folder(rootPath + "/" + art.type);
                if (!typeFolder.exists) typeFolder.create();
                var colorFolder = new Folder(typeFolder.fsName + "/" + art.colorVariation);
                if (!colorFolder.exists) colorFolder.create();

                for (var fmt in params.exportFormats) {
                    if (!params.exportFormats[fmt]) continue;
                    var fmtFolder = new Folder(colorFolder.fsName + "/" + fmt.toUpperCase());
                    if (!fmtFolder.exists) fmtFolder.create();

                    if (fmt === "png" || fmt === "jpg") {
                        for (var s = 0; s < activeSizes.length; s++) {
                            var sz = activeSizes[s];
                            exportArtboardWithPrefix(doc, art.name, fmtFolder.fsName, fmt, sz.size, sz.prefix);
                        }
                    } else {
                        exportArtboard(doc, art.name, fmtFolder.fsName, fmt, artboardSize);
                    }
                }
            }
        }

        $.writeln("✅ Génération complétée: " + artboardCount + " artboards créés");
        return "SUCCESS:" + artboardCount;

    } catch (e) {
        $.writeln("❌ Erreur critique dans generateArtboards: " + e.toString());
        // ✨ NETTOYAGE MÊME EN CAS D'ERREUR
        try {
            cleanupHiddenElements();
        } catch (cleanupError) {
            $.writeln("❌ Erreur lors du nettoyage après erreur: " + cleanupError.toString());
        }
        return "ERROR: " + e.toString();
    }
}

// Créer un rectangle de fond
function createBackgroundRect(doc, x, y, width, height, color) {
    var rect = doc.pathItems.rectangle(y, x, width, height);
    rect.filled = true;
    rect.stroked = false;
    rect.fillColor = color;
    return rect;
}

// Créer un artboard fit-content
function createFitArtboard(doc, element, width, x, y, name, withBlackBg) {
    try {
        // ✨ DUPLICATION ET MESURE D'ABORD (élément peut avoir des coords extrêmes)
        var copy = element.duplicate();
        copy.hidden = false;

        // Mesurer les dimensions RÉELLES de l'élément
        var bounds = copy.visibleBounds;
        var elementWidth = bounds[2] - bounds[0];
        var elementHeight = bounds[1] - bounds[3];

        if (elementWidth <= 0) elementWidth = 1;
        if (elementHeight <= 0) elementHeight = 1;

        var ratio = elementHeight / elementWidth;
        var height = width * ratio;

        // ✨ SÉCURITÉ: Limiter la hauteur max pour éviter débordement
        var maxAllowedHeight = 16000; // Bien en dessous de 16383
        if (height > maxAllowedHeight) {
            $.writeln("⚠️ Hauteur artboard trop grande (" + height.toFixed(0) + "), limitée à " + maxAllowedHeight);
            height = maxAllowedHeight;
            width = height / ratio;
        }

        // ✨ CONSTRUCTION du rectangle artboard (toujours en coordonnées sûres)
        var left = x;
        var top = y;
        var right = x + width;
        var bottom = y - height;

        var artboardRect = [left, top, right, bottom];

        // ✨ VALIDATION CRITIQUE avant création
        var validation = validateArtboardRect(artboardRect);
        if (!validation.valid) {
            $.writeln("❌ Artboard fit invalide pour '" + name + "': " + validation.error);
            $.writeln("   Dimensions originales: W=" + elementWidth.toFixed(1) + ", H=" + elementHeight.toFixed(1));
            $.writeln("   Artboard calculé: L=" + left + ", T=" + top + ", R=" + right + ", B=" + bottom);
            copy.remove(); // Nettoyer
            throw new Error("Artboard invalide: " + validation.error);
        }

        // Utiliser le rectangle validé (potentiellement corrigé)
        artboardRect = validation.rect;

        // Recalculer dimensions finales
        var finalWidth = artboardRect[2] - artboardRect[0];
        var finalHeight = artboardRect[1] - artboardRect[3];

        // Créer l'artboard
        var artboard = doc.artboards.add(artboardRect);
        artboard.name = name;

        // ✨ REPOSITIONNER et REDIMENSIONNER la copie
        // Calculer le scale factor basé sur la largeur finale
        var scaleFactor = (finalWidth / elementWidth) * 100;
        copy.resize(scaleFactor, scaleFactor, true, true, true, true, scaleFactor, Transformation.TOPLEFT);

        // Positionner au coin supérieur gauche de l'artboard
        copy.position = [artboardRect[0], artboardRect[1]];

        // Ajouter fond noir en arrière-plan si demandé
        if (withBlackBg) {
            var blackColor = new RGBColor();
            blackColor.red = 0;
            blackColor.green = 0;
            blackColor.blue = 0;
            var bgRect = createBackgroundRect(doc, artboardRect[0], artboardRect[1], finalWidth, finalHeight, blackColor);
            bgRect.zOrder(ZOrderMethod.SENDTOBACK);
        }

        return finalHeight;
    } catch (e) {
        $.writeln("❌ Erreur createFitArtboard: " + e.toString());
        throw new Error("Erreur createFitArtboard: " + e.toString());
    }
}

// Créer un artboard carré
function createSquareArtboard(doc, element, size, x, y, name, withBlackBg) {
    try {
        // ✨ SÉCURITÉ: Limiter la taille max
        var maxAllowedSize = 16000; // Bien en dessous de 16383
        if (size > maxAllowedSize) {
            $.writeln("⚠️ Taille artboard trop grande (" + size + "), limitée à " + maxAllowedSize);
            size = maxAllowedSize;
        }

        // ✨ CONSTRUCTION du rectangle artboard
        var left = x;
        var top = y;
        var right = x + size;
        var bottom = y - size;

        var artboardRect = [left, top, right, bottom];

        // ✨ VALIDATION CRITIQUE avant création
        var validation = validateArtboardRect(artboardRect);
        if (!validation.valid) {
            $.writeln("❌ Artboard square invalide pour '" + name + "': " + validation.error);
            $.writeln("   Dimensions: L=" + left + ", T=" + top + ", R=" + right + ", B=" + bottom);
            throw new Error("Artboard invalide: " + validation.error);
        }

        // Utiliser le rectangle validé (potentiellement corrigé)
        artboardRect = validation.rect;

        // Recalculer la taille finale (peut avoir été ajustée)
        var finalSize = Math.min(
            artboardRect[2] - artboardRect[0],
            artboardRect[1] - artboardRect[3]
        );

        // Créer l'artboard
        var artboard = doc.artboards.add(artboardRect);
        artboard.name = name;

        // ✨ DUPLICATION ET MESURE
        var copy = element.duplicate();
        copy.hidden = false;

        var bounds = copy.visibleBounds;
        var elementWidth = bounds[2] - bounds[0];
        var elementHeight = bounds[1] - bounds[3];

        if (elementWidth <= 0) elementWidth = 1;
        if (elementHeight <= 0) elementHeight = 1;

        // Calculer le scale pour que l'élément tienne dans 80% de l'artboard
        var maxSize = finalSize * 0.8;
        var scaleX = maxSize / elementWidth;
        var scaleY = maxSize / elementHeight;
        var scaleFactor = Math.min(scaleX, scaleY) * 100;

        // Redimensionner
        copy.resize(scaleFactor, scaleFactor, true, true, true, true, scaleFactor, Transformation.TOPLEFT);

        // Mesurer après resize
        var newBounds = copy.visibleBounds;
        var newWidth = newBounds[2] - newBounds[0];
        var newHeight = newBounds[1] - newBounds[3];

        // Centrer dans l'artboard
        var centerX = artboardRect[0] + (finalSize - newWidth) / 2;
        var centerY = artboardRect[1] - (finalSize - newHeight) / 2;
        copy.position = [centerX, centerY];

        // Ajouter fond noir en arrière-plan si demandé
        if (withBlackBg) {
            var blackColor = new RGBColor();
            blackColor.red = 0;
            blackColor.green = 0;
            blackColor.blue = 0;
            var bgRect = createBackgroundRect(doc, artboardRect[0], artboardRect[1], finalSize, finalSize, blackColor);
            bgRect.zOrder(ZOrderMethod.SENDTOBACK);
        }

        return finalSize;
    } catch (e) {
        $.writeln("❌ Erreur createSquareArtboard: " + e.toString());
        throw new Error("Erreur createSquareArtboard: " + e.toString());
    }
}

// Nettoyer les éléments cachés temporaires
function cleanupHiddenElements() {
    var cleaned = 0;
    var errors = 0;
    var skipped = 0;

    $.writeln("🧹 Début du nettoyage des éléments cachés...");

    try {
        for (var key in storedSelections) {
            if (storedSelections.hasOwnProperty(key)) {
                var element = storedSelections[key];

                if (!element) {
                    skipped++;
                    continue;
                }

                try {
                    // Vérifier que l'élément existe encore
                    if (element.typename) {
                        // Vérifier s'il est caché
                        if (element.hidden) {
                            element.remove();
                            cleaned++;
                            $.writeln("  ✓ Supprimé: " + key);
                        } else {
                            // Élément existe mais n'est pas caché (cas anormal)
                            $.writeln("  ⚠️ Élément '" + key + "' existe mais n'est pas caché");
                            skipped++;
                        }
                    }
                } catch (e) {
                    // L'élément a peut-être déjà été supprimé
                    $.writeln("  ⚠️ Erreur suppression '" + key + "': " + e.toString());
                    errors++;
                }

                // Toujours réinitialiser la référence
                storedSelections[key] = null;
            }
        }

        $.writeln("✅ Nettoyage terminé: " + cleaned + " supprimés, " + skipped + " ignorés, " + errors + " erreurs");

    } catch (e) {
        $.writeln("❌ Erreur critique dans cleanupHiddenElements: " + e.toString());
    }
}

// Fonctions d'exportation (non modifiées)
function exportArtboard(doc, artboardName, folderPath, format, exportSize) {
    var idx = -1;
    for (var k = 0; k < doc.artboards.length; k++) {
        if (doc.artboards[k].name === artboardName) { idx = k; break; }
    }
    if (idx < 0) return;
    doc.artboards.setActiveArtboardIndex(idx);
    var baseFile = folderPath + "/" + artboardName;

    if (format === "png") {
        var opts = new ExportOptionsPNG24();
        opts.artBoardClipping = true;
        var scale = (exportSize / 1000) * 100;
        opts.horizontalScale = scale;
        opts.verticalScale = scale;
        doc.exportFile(new File(baseFile + ".png"), ExportType.PNG24, opts);
    } else if (format === "jpg") {
        var opts = new ExportOptionsJPEG();
        opts.artBoardClipping = true;
        opts.qualitySetting = 80;
        var scale = (exportSize / 1000) * 100;
        opts.horizontalScale = scale;
        opts.verticalScale = scale;
        doc.exportFile(new File(baseFile + ".jpg"), ExportType.JPEG, opts);
    } else if (format === "svg") {
        exportForScreensSVG(doc, idx, baseFile, artboardName);
    } else if (format === "ai") {
        var saveOpts = new IllustratorSaveOptions();
        saveOpts.saveMultipleArtboards = true;
        saveOpts.artboardRange = String(idx + 1);
        doc.saveAs(new File(baseFile + ".ai"), saveOpts);
    } else if (format === "pdf") {
        exportForScreensPDF(doc, idx, baseFile, artboardName);
    }
}

function generateVerticalVersion() {
    try {
        if (app.documents.length === 0) return "NO_DOCUMENT";
        var doc = app.activeDocument;

        if (!storedSelections.icon || !storedSelections.text) {
            return "ERROR: Les deux éléments (icône + typographie) doivent être sélectionnés";
        }

        // ✨ VALIDATION des éléments avant génération
        var iconValidation = validateElement(storedSelections.icon);
        if (!iconValidation.valid) {
            return "ERROR: Icône invalide - " + iconValidation.error;
        }

        var textValidation = validateElement(storedSelections.text);
        if (!textValidation.valid) {
            return "ERROR: Typographie invalide - " + textValidation.error;
        }

        var insigne = storedSelections.icon.duplicate();
        var logotype = storedSelections.text.duplicate();
        insigne.hidden = false;
        logotype.hidden = false;

        var bLogotype = logotype.geometricBounds;
        var logotypeWidth = bLogotype[2] - bLogotype[0];
        var logotypeHeight = bLogotype[1] - bLogotype[3];

        var bInsigne = insigne.geometricBounds;
        var insigneHeight = bInsigne[1] - bInsigne[3];
        var third = logotypeHeight / 2.5;

        var targetHeight = logotypeHeight + 2 * third;
        var scale = (targetHeight / insigneHeight) * 100;
        insigne.resize(scale, scale);

        var bInsigneNew = insigne.geometricBounds;
        var insigneWidth = bInsigneNew[2] - bInsigneNew[0];
        var insigneHeightNew = bInsigneNew[1] - bInsigneNew[3];

        // ✨ CALCUL DE POSITION SÉCURISÉ (toujours commencer à 0,0)
        var spacing = 100;
        var maxX = 0;
        var maxY = 0;

        // Trouver la position la plus à droite des artboards existants
        if (doc.artboards.length > 0) {
            for (var i = 0; i < doc.artboards.length; i++) {
                var ab = doc.artboards[i].artboardRect;
                if (ab[2] > maxX) maxX = ab[2];
            }
        }

        var artboardX = maxX + spacing;

        // Centrage horizontal
        var widest = Math.max(insigneWidth, logotypeWidth);
        var centerX = artboardX + widest / 2;
        var insigneX = centerX - insigneWidth / 2;
        var logotypeX = centerX - logotypeWidth / 2;

        // Position verticale : insigne en haut (y positif), texte en bas
        var totalHeight = insigneHeightNew + third + logotypeHeight;
        var topY = 0; // Commencer à 0
        var insigneY = topY;
        var logotypeY = topY - insigneHeightNew - third;

        insigne.position = [insigneX, insigneY];
        logotype.position = [logotypeX, logotypeY];

        // Grouper les deux
        var group = doc.groupItems.add();
        insigne.move(group, ElementPlacement.PLACEATEND);
        logotype.move(group, ElementPlacement.PLACEATEND);

        // Créer un plan de travail autour du groupe
        var gb = group.visibleBounds;
        var margin = 50;
        var width = (gb[2] - gb[0]) + (margin * 2);
        var height = (gb[1] - gb[3]) + (margin * 2);

        // ✨ CONSTRUCTION SÉCURISÉE du rectangle artboard
        var left = gb[0] - margin;
        var top = gb[1] + margin;
        var right = left + width;
        var bottom = top - height;

        var artboardRect = [left, top, right, bottom];

        // ✨ VALIDATION du rectangle artboard
        var validation = validateArtboardRect(artboardRect);
        if (!validation.valid) {
            // Nettoyer le groupe créé
            try { group.remove(); } catch(e) {}
            return "ERROR: Artboard invalide - " + validation.error;
        }

        // Utiliser le rectangle validé (potentiellement corrigé)
        artboardRect = validation.rect;

        var newArtboard = doc.artboards.add(artboardRect);
        newArtboard.name = "version_verticale_tiers";

        $.writeln("✓ Version verticale générée avec succès");
        return "OK";

    } catch (e) {
        $.writeln("❌ Erreur generateVerticalVersion: " + e.toString());
        return "ERROR: " + e.toString();
    }
}

function generateHorizontalVersion() {
    try {
        if (app.documents.length === 0) return "NO_DOCUMENT";
        var doc = app.activeDocument;

        if (!storedSelections.icon || !storedSelections.text) {
            return "ERROR: Les deux éléments (icône + typographie) doivent être sélectionnés";
        }

        // ✨ VALIDATION des éléments avant génération
        var iconValidation = validateElement(storedSelections.icon);
        if (!iconValidation.valid) {
            return "ERROR: Icône invalide - " + iconValidation.error;
        }

        var textValidation = validateElement(storedSelections.text);
        if (!textValidation.valid) {
            return "ERROR: Typographie invalide - " + textValidation.error;
        }

        var insigne = storedSelections.icon.duplicate();
        var logotype = storedSelections.text.duplicate();
        insigne.hidden = false;
        logotype.hidden = false;

        var bLogotype = logotype.geometricBounds;
        var logotypeWidth = bLogotype[2] - bLogotype[0];
        var logotypeHeight = bLogotype[1] - bLogotype[3];

        var bInsigne = insigne.geometricBounds;
        var insigneHeight = bInsigne[1] - bInsigne[3];
        var third = logotypeHeight / 3;

        var targetHeight = logotypeHeight + 2 * third;
        var scale = (targetHeight / insigneHeight) * 100;
        insigne.resize(scale, scale);

        var bInsigneNew = insigne.geometricBounds;
        var insigneWidth = bInsigneNew[2] - bInsigneNew[0];
        var insigneHeightNew = bInsigneNew[1] - bInsigneNew[3];

        // ✨ CALCUL DE POSITION SÉCURISÉ (toujours commencer à 0,0)
        var spacing = 100;
        var maxX = 0;

        // Trouver la position la plus à droite des artboards existants
        if (doc.artboards.length > 0) {
            for (var i = 0; i < doc.artboards.length; i++) {
                var ab = doc.artboards[i].artboardRect;
                if (ab[2] > maxX) maxX = ab[2];
            }
        }

        var artboardX = maxX + spacing;

        // Position horizontale : insigne à gauche, texte à droite
        var insigneX = artboardX;
        var logotypeX = insigneX + insigneWidth + third;

        // Aligner verticalement (centrage)
        var maxHeight = Math.max(insigneHeightNew, logotypeHeight);
        var topY = 0; // Commencer à 0
        var insigneY = topY - (maxHeight - insigneHeightNew) / 2;
        var logotypeY = topY - (maxHeight - logotypeHeight) / 2;

        insigne.position = [insigneX, insigneY];
        logotype.position = [logotypeX, logotypeY];

        // Grouper les deux
        var group = doc.groupItems.add();
        insigne.move(group, ElementPlacement.PLACEATEND);
        logotype.move(group, ElementPlacement.PLACEATEND);

        // Créer un plan de travail autour du groupe
        var gb = group.visibleBounds;
        var margin = 50;
        var width = (gb[2] - gb[0]) + (margin * 2);
        var height = (gb[1] - gb[3]) + (margin * 2);

        // ✨ CONSTRUCTION SÉCURISÉE du rectangle artboard
        var left = gb[0] - margin;
        var top = gb[1] + margin;
        var right = left + width;
        var bottom = top - height;

        var artboardRect = [left, top, right, bottom];

        // ✨ VALIDATION du rectangle artboard
        var validation = validateArtboardRect(artboardRect);
        if (!validation.valid) {
            // Nettoyer le groupe créé
            try { group.remove(); } catch(e) {}
            return "ERROR: Artboard invalide - " + validation.error;
        }

        // Utiliser le rectangle validé (potentiellement corrigé)
        artboardRect = validation.rect;

        var newArtboard = doc.artboards.add(artboardRect);
        newArtboard.name = "version_horizontale_tiers";

        $.writeln("✓ Version horizontale générée avec succès");
        return "OK";

    } catch (e) {
        $.writeln("❌ Erreur generateHorizontalVersion: " + e.toString());
        return "ERROR: " + e.toString();
    }
}




function exportArtboardWithPrefix(doc, artboardName, folderPath, format, exportSize, prefix) {
    var idx = -1;
    for (var k = 0; k < doc.artboards.length; k++) {
        if (doc.artboards[k].name === artboardName) { idx = k; break; }
    }
    if (idx < 0) return;
    doc.artboards.setActiveArtboardIndex(idx);
    var baseFile = folderPath + "/" + prefix + artboardName;

    if (format === "png") {
        var opts = new ExportOptionsPNG24();
        opts.artBoardClipping = true;
        var scale = (exportSize / 1000) * 100;
        opts.horizontalScale = scale;
        opts.verticalScale = scale;
        doc.exportFile(new File(baseFile + ".png"), ExportType.PNG24, opts);
    } else if (format === "jpg") {
        var opts = new ExportOptionsJPEG();
        opts.artBoardClipping = true;
        opts.qualitySetting = 80;
        var scale = (exportSize / 1000) * 100;
        opts.horizontalScale = scale;
        opts.verticalScale = scale;
        doc.exportFile(new File(baseFile + ".jpg"), ExportType.JPEG, opts);
    }
}

function exportForScreensSVG(doc, artboardIndex, baseFilePath, artboardName) {
    try {
        var exportOptions = new ExportForScreensOptionsWebOptimizedSVG();
        exportOptions.coordinatePrecision = 2;
        exportOptions.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
        exportOptions.fontType = SVGFontType.OUTLINEFONT;
        exportOptions.rasterImageLocation = RasterImageLocation.EMBED;
        exportOptions.svgId = SVGIdType.SVGIDMINIMAL;
        exportOptions.svgMinify = false;
        exportOptions.svgResponsive = false;
        
        var itemsToExport = new ExportForScreensItemToExport();
        itemsToExport.artboards = String(artboardIndex + 1);
        itemsToExport.document = false;
        
        var fileSpec = new File(baseFilePath + ".svg");
        doc.exportForScreens(fileSpec.parent, ExportForScreensType.SE_SVG, exportOptions, itemsToExport, artboardName);
    } catch (e) {
        try {
            var opts = new ExportOptionsSVG();
            opts.exportArtboards = true;
            opts.artboardRange = String(artboardIndex + 1);
            opts.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
            opts.fontType = SVGFontType.OUTLINEFONT;
            opts.embedRasterImages = true;
            doc.exportFile(new File(baseFilePath + ".svg"), ExportType.SVG, opts);
        } catch (fallbackError) {}
    }
}

function exportForScreensPDF(doc, artboardIndex, baseFilePath, artboardName) {
    try {
        var exportOptions = new ExportForScreensPDFOptions();
        var itemsToExport = new ExportForScreensItemToExport();
        itemsToExport.artboards = String(artboardIndex + 1);
        itemsToExport.document = false;
        
        var fileSpec = new File(baseFilePath + ".pdf");
        doc.exportForScreens(fileSpec.parent, ExportForScreensType.SE_PDF, exportOptions, itemsToExport, artboardName);
    } catch (e) {
        try {
            var saveOpts = new PDFSaveOptions();
            saveOpts.compatibility = PDFCompatibility.ACROBAT7;
            saveOpts.generateThumbnails = true;
            saveOpts.preserveEditability = false;
            saveOpts.preset = "[High Quality Print]";
            saveOpts.viewAfterSaving = false;
            saveOpts.saveMultipleArtboards = true;
            saveOpts.artboardRange = String(artboardIndex + 1);
            doc.saveAs(new File(baseFilePath + ".pdf"), saveOpts);
        } catch (fallbackError) {}
    }
}