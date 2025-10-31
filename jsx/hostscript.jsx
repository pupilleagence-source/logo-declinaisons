/**
 * Logo Déclinaisons - ExtendScript
 * Code côté Illustrator
 */

var storedSelections = {
    horizontal: null,
    vertical: null,
    icon: null,
    text: null,
    custom1: null,
    custom2: null,
    custom3: null
};

/**
 * Constantes pour les limites d'Illustrator
 */
var ILLUSTRATOR_MAX_CANVAS = 16383; // Points (227 inches)
var ILLUSTRATOR_MIN_CANVAS = -16383;

/**
 * Valide qu'une couleur hexadécimale est valide
 * @param {string} hex - La couleur hexadécimale à valider
 * @return {boolean} true si valide, false sinon
 */
function validateHex(hex) {
    if (!hex || typeof hex !== 'string') return false;
    var cleanHex = hex.charAt(0) === '#' ? hex.substring(1) : hex;
    if (cleanHex.length !== 3 && cleanHex.length !== 6) return false;
    return /^[0-9A-Fa-f]+$/.test(cleanHex);
}

/**
 * Sanitise un nom de fichier en remplaçant les caractères dangereux
 * @param {string} filename - Le nom de fichier à sanitiser
 * @return {string} Le nom de fichier sécurisé
 */
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return 'unnamed';
    // Remplacer les caractères interdits par des underscores
    var sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');
    // Limiter la longueur à 200 caractères
    if (sanitized.length > 200) {
        sanitized = sanitized.substring(0, 200);
    }
    // S'assurer qu'il n'est pas vide après sanitisation
    return sanitized.length > 0 ? sanitized : 'unnamed';
}

/**
 * Parse JSON de manière sécurisée (alternative à eval pour ExtendScript)
 * Utilise une approche simplifiée pour les paramètres de notre application
 * @param {string} jsonString - La chaîne JSON à parser
 * @return {Object|null} L'objet parsé ou null si erreur
 */
function safeParseJSON(jsonString) {
    try {
        // ExtendScript CC 2014+ supporte JSON nativement
        if (typeof JSON !== 'undefined' && JSON.parse) {
            return JSON.parse(jsonString);
        }

        // Fallback: Validation basique avant eval (protection minimale)
        // Vérifier que c'est bien un objet JSON et pas du code arbitraire
        if (!jsonString || typeof jsonString !== 'string') {
            throw new Error('JSON invalide: pas une chaîne');
        }

        // Nettoyer et valider
        var trimmed = jsonString.replace(/^\s+|\s+$/g, '');
        if (trimmed.charAt(0) !== '{' || trimmed.charAt(trimmed.length - 1) !== '}') {
            throw new Error('JSON invalide: doit être un objet');
        }

        // Vérifier qu'il n'y a pas de code dangereux
        if (/function|eval|constructor|\bthis\b|prototype|__proto__/.test(trimmed)) {
            throw new Error('JSON invalide: contenu suspect détecté');
        }

        // En dernier recours, utiliser eval avec précautions
        return eval('(' + trimmed + ')');

    } catch (e) {
        $.writeln("❌ Erreur parsing JSON: " + e.toString());
        return null;
    }
}

/**
 * Valide qu'un élément est utilisable pour la génération
 * @param {PageItem} item - L'élément à valider
 * @return {Object} {valid: boolean, error: string}
 */
function validateElement(item) {
    if (!item) {
        return {valid: false, error: "Aucun élément n'a été trouvé. Veuillez sélectionner à nouveau."};
    }

    if (!item.typename) {
        return {valid: false, error: "L'élément sélectionné n'est pas valide. Essayez de le grouper avant de le sélectionner."};
    }

    if (item.locked) {
        return {valid: false, error: "L'élément est verrouillé. Déverrouillez-le dans le panneau Calques avant de continuer."};
    }

    try {
        var bounds = item.visibleBounds;
        var width = bounds[2] - bounds[0];
        var height = bounds[1] - bounds[3];

        if (width <= 0 || height <= 0) {
            return {valid: false, error: "L'élément sélectionné a des dimensions invalides. Vérifiez qu'il est visible et non vide."};
        }

        if (width > 20000 || height > 20000) {
            return {valid: false, error: "L'élément est trop grand (maximum recommandé : 20000 px). Réduisez sa taille avant de continuer."};
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
        return {valid: false, error: "Impossible de lire les dimensions de l'élément. Vérifiez qu'il n'est pas corrompu."};
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
        return {valid: false, rect: rect, error: "Impossible de créer le plan de travail : dimensions invalides. Vérifiez que vos éléments ont une hauteur correcte."};
    }

    // Vérifier que right > left
    if (right <= left) {
        return {valid: false, rect: rect, error: "Impossible de créer le plan de travail : dimensions invalides. Vérifiez que vos éléments ont une largeur correcte."};
    }

    var width = right - left;
    var height = top - bottom;

    // Dimensions minimum
    if (width < 1 || height < 1) {
        return {valid: false, rect: rect, error: "Le plan de travail serait trop petit. Vérifiez que vos éléments sont visibles et ont une taille minimale."};
    }

    // Dimensions maximum
    if (width > 16383 || height > 16383) {
        return {valid: false, rect: rect, error: "Le plan de travail serait trop grand (maximum 227 inches / 577 cm). Réduisez la taille de vos éléments."};
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
        $.writeln("❌ Erreur getSelectionInfo: " + e.toString());
        return "ERROR: Impossible de vérifier la sélection. Réessayez.";
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
            // 🎨 Extraire fillColor (RGB ou CMYK)
            if (item.filled) {
                var hex = null;
                if (item.fillColor.typename === "RGBColor") {
                    hex = rgbToHex(item.fillColor);
                } else if (item.fillColor.typename === "CMYKColor") {
                    hex = cmykToHex(item.fillColor);
                }

                if (hex && !colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }

            // 🎨 Extraire strokeColor (RGB ou CMYK)
            if (colorCount < 10 && item.stroked) {
                var hex = null;
                if (item.strokeColor.typename === "RGBColor") {
                    hex = rgbToHex(item.strokeColor);
                } else if (item.strokeColor.typename === "CMYKColor") {
                    hex = cmykToHex(item.strokeColor);
                }

                if (hex && !colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }
        } else if (item.typename === "TextFrame") {
            var textRange = item.textRange;

            // 🎨 Extraire fillColor du texte (RGB ou CMYK)
            if (textRange.characterAttributes.fillColor) {
                var fillColorType = textRange.characterAttributes.fillColor.typename;
                var hex = null;

                if (fillColorType === "RGBColor") {
                    hex = rgbToHex(textRange.characterAttributes.fillColor);
                } else if (fillColorType === "CMYKColor") {
                    hex = cmykToHex(textRange.characterAttributes.fillColor);
                }

                if (hex && !colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }

            // 🎨 Extraire strokeColor du texte (RGB ou CMYK)
            if (colorCount < 10 && textRange.characterAttributes.strokeColor) {
                var strokeColorType = textRange.characterAttributes.strokeColor.typename;
                var hex = null;

                if (strokeColorType === "RGBColor") {
                    hex = rgbToHex(textRange.characterAttributes.strokeColor);
                } else if (strokeColorType === "CMYKColor") {
                    hex = cmykToHex(textRange.characterAttributes.strokeColor);
                }

                if (hex && !colorSet[hex]) {
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
    // Validation de la couleur hexadécimale
    if (!validateHex(hex)) {
        $.writeln("⚠️ Couleur hexadécimale invalide: " + hex + ", utilisation de #000000 par défaut");
        return { r: 0, g: 0, b: 0 };
    }

    var cleanHex = hex.charAt(0) === '#' ? hex.substring(1) : hex;

    // Support du format court #RGB → #RRGGBB
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.charAt(0) + cleanHex.charAt(0) +
                   cleanHex.charAt(1) + cleanHex.charAt(1) +
                   cleanHex.charAt(2) + cleanHex.charAt(2);
    }

    var r = parseInt(cleanHex.substring(0, 2), 16);
    var g = parseInt(cleanHex.substring(2, 4), 16);
    var b = parseInt(cleanHex.substring(4, 6), 16);

    // Vérification finale des valeurs
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        $.writeln("⚠️ Erreur conversion RGB pour: " + hex + ", utilisation de #000000 par défaut");
        return { r: 0, g: 0, b: 0 };
    }

    return { r: r, g: g, b: b };
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
function applyCustomColors(element, colorMapping, tmpPaths) {
    try {
        applyCustomColorsRecursive(element, colorMapping, tmpPaths);
        return true;
    } catch (e) {
        $.writeln("Erreur dans applyCustomColors : " + e.toString());
        return false;
    }
}

function applyCustomColorsRecursive(item, colorMapping, tmpPaths) {
    try {
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                applyCustomColorsRecursive(item.pageItems[i], colorMapping, tmpPaths);
            }
        } else if (item.typename === "CompoundPathItem") {
            // 🔧 CORRECTION: Gérer les CompoundPathItems vides (même logique que monochrome)
            if (item.pathItems.length === 0) {
                var tmp = item.pathItems.add();
                tmpPaths.push(tmp);
            }

            for (var i = 0; i < item.pathItems.length; i++) {
                applyCustomColorsRecursive(item.pathItems[i], colorMapping, tmpPaths);
            }
            return;
        } else if (item.typename === "PathItem") {
            // 🔧 CORRECTION: Activer le remplissage pour les paths qui ont des points
            // (même logique que monochrome pour gérer les compound paths)
            if (!item.filled && item.pathPoints.length > 0) {
                item.filled = true;
            }

            // 🎨 GESTION RGB ET CMYK pour fillColor
            if (item.filled) {
                var hex = null;

                // Extraire la couleur en hex (RGB ou CMYK)
                if (item.fillColor.typename === "RGBColor") {
                    hex = rgbToHex(item.fillColor);
                } else if (item.fillColor.typename === "CMYKColor") {
                    hex = cmykToHex(item.fillColor);
                }

                if (hex) {
                    var newHex = findCustomColor(hex, colorMapping);
                    if (newHex && newHex !== hex) {
                        // 🔑 TOUJOURS créer une RGBColor et laisser Illustrator faire la conversion
                        // C'est la stratégie de monochrome qui fonctionne!
                        item.fillColor = hexToRGBColor(newHex);
                    }
                }
            }

            // 🎨 GESTION RGB ET CMYK pour strokeColor
            if (item.stroked) {
                var hex = null;

                // Extraire la couleur en hex (RGB ou CMYK)
                if (item.strokeColor.typename === "RGBColor") {
                    hex = rgbToHex(item.strokeColor);
                } else if (item.strokeColor.typename === "CMYKColor") {
                    hex = cmykToHex(item.strokeColor);
                }

                if (hex) {
                    var newHex = findCustomColor(hex, colorMapping);
                    if (newHex && newHex !== hex) {
                        // 🔑 TOUJOURS créer une RGBColor et laisser Illustrator faire la conversion
                        item.strokeColor = hexToRGBColor(newHex);
                    }
                }
            }
        } else if (item.typename === "TextFrame") {
            var textRange = item.textRange;

            // 🎨 GESTION RGB ET CMYK pour fillColor du texte
            if (textRange.characterAttributes.fillColor) {
                var fillColorType = textRange.characterAttributes.fillColor.typename;
                var hex = null;

                if (fillColorType === "RGBColor") {
                    hex = rgbToHex(textRange.characterAttributes.fillColor);
                } else if (fillColorType === "CMYKColor") {
                    hex = cmykToHex(textRange.characterAttributes.fillColor);
                }

                if (hex) {
                    var newHex = findCustomColor(hex, colorMapping);
                    if (newHex && newHex !== hex) {
                        // 🔑 TOUJOURS créer une RGBColor et laisser Illustrator faire la conversion
                        textRange.characterAttributes.fillColor = hexToRGBColor(newHex);
                    }
                }
            }

            // 🎨 GESTION RGB ET CMYK pour strokeColor du texte
            if (textRange.characterAttributes.strokeColor) {
                var strokeColorType = textRange.characterAttributes.strokeColor.typename;
                var hex = null;

                if (strokeColorType === "RGBColor") {
                    hex = rgbToHex(textRange.characterAttributes.strokeColor);
                } else if (strokeColorType === "CMYKColor") {
                    hex = cmykToHex(textRange.characterAttributes.strokeColor);
                }

                if (hex) {
                    var newHex = findCustomColor(hex, colorMapping);
                    if (newHex && newHex !== hex) {
                        // 🔑 TOUJOURS créer une RGBColor et laisser Illustrator faire la conversion
                        textRange.characterAttributes.strokeColor = hexToRGBColor(newHex);
                    }
                }
            }
        } else if (item.pageItems && item.pageItems.length > 0) {
            for (var i = 0; i < item.pageItems.length; i++) {
                applyCustomColorsRecursive(item.pageItems[i], colorMapping, tmpPaths);
            }
        }
    } catch (e) {
        $.writeln("Erreur applyCustomColorsRecursive: " + e.toString());
    }
}

// Calculer la distance entre deux couleurs hexadécimales
function colorDistance(hex1, hex2) {
    var rgb1 = hexToRGB(hex1);
    var rgb2 = hexToRGB(hex2);

    // Distance euclidienne dans l'espace RGB
    var dr = rgb1.r - rgb2.r;
    var dg = rgb1.g - rgb2.g;
    var db = rgb1.b - rgb2.b;

    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function findCustomColor(originalHex, colorMapping) {
    // 1. Essayer d'abord un match exact
    for (var i = 0; i < colorMapping.length; i++) {
        if (colorMapping[i].original.toLowerCase() === originalHex.toLowerCase()) {
            return colorMapping[i].custom;
        }
    }

    // 2. Si pas de match exact, chercher la couleur la plus proche
    // Cela gère les conversions RGB<->CMYK qui peuvent être légèrement différentes
    var threshold = 30; // Seuil de tolérance (sur 255, donc ~12%)
    var bestMatch = null;
    var bestDistance = Infinity;

    for (var i = 0; i < colorMapping.length; i++) {
        var distance = colorDistance(originalHex, colorMapping[i].original);
        if (distance < bestDistance && distance < threshold) {
            bestDistance = distance;
            bestMatch = colorMapping[i].custom;
        }
    }

    if (bestMatch) {
        $.writeln("   🎨 Correspondance approximative trouvée: " + originalHex + " → " + bestMatch + " (distance: " + bestDistance.toFixed(1) + ")");
        return bestMatch;
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

// Convertir une couleur CMYK en hexadécimal (via RGB approximatif)
function cmykToHex(cmykColor) {
    try {
        // Conversion CMYK vers RGB (approximation)
        var c = cmykColor.cyan / 100;
        var m = cmykColor.magenta / 100;
        var y = cmykColor.yellow / 100;
        var k = cmykColor.black / 100;

        var r = Math.round(255 * (1 - c) * (1 - k));
        var g = Math.round(255 * (1 - m) * (1 - k));
        var b = Math.round(255 * (1 - y) * (1 - k));

        var hex = "#" +
            ("0" + r.toString(16)).slice(-2) +
            ("0" + g.toString(16)).slice(-2) +
            ("0" + b.toString(16)).slice(-2);

        return hex.toUpperCase();
    } catch (e) {
        $.writeln("Erreur cmykToHex: " + e.toString());
        return "#000000";
    }
}

// Convertir hexadécimal en CMYKColor
function hexToCMYKColor(hex) {
    var rgb = hexToRGB(hex);

    // Normaliser RGB (0-1)
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;

    // Conversion RGB vers CMYK
    var k = 1 - Math.max(r, g, b);
    var c = k === 1 ? 0 : (1 - r - k) / (1 - k);
    var m = k === 1 ? 0 : (1 - g - k) / (1 - k);
    var y = k === 1 ? 0 : (1 - b - k) / (1 - k);

    var color = new CMYKColor();
    color.cyan = c * 100;
    color.magenta = m * 100;
    color.yellow = y * 100;
    color.black = k * 100;

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

/**
 * Crée un nouveau document pour l'exportation avec les paramètres spécifiés
 * @param {Document} sourceDoc - Le document source (pour récupérer rulerUnits)
 * @param {Object} documentSettings - Paramètres du document (colorMode, ppi)
 * @return {Document|null} Le nouveau document ou null si erreur
 */
function createExportDocument(sourceDoc, documentSettings) {
    try {
        $.writeln("📄 Création d'un nouveau document pour l'exportation...");

        // Générer timestamp pour nom unique
        var now = new Date();
        var timestamp = now.getFullYear() +
                       padZero(now.getMonth() + 1) +
                       padZero(now.getDate()) + "_" +
                       padZero(now.getHours()) +
                       padZero(now.getMinutes()) +
                       padZero(now.getSeconds());

        var docName = "exportation-logotypes_" + timestamp;

        // 🎯 Utiliser les paramètres du document depuis documentSettings
        var colorSpace = DocumentColorSpace.RGB; // Valeur par défaut
        if (documentSettings && documentSettings.colorMode) {
            if (documentSettings.colorMode === 'CMYK') {
                colorSpace = DocumentColorSpace.CMYK;
            }
        }

        var rulerUnits = sourceDoc.rulerUnits;

        // 🎯 SOLUTION ULTRA-SIMPLE : Créer le document directement avec 50×50 points
        // Cela crée automatiquement un artboard de 50×50, qu'on déplacera ensuite
        var newDoc = null;
        var tempSize = 50; // Taille minimale en points

        $.writeln("   Création du document avec artboard minimal (50×50 points)...");

        try {
            // Créer le document avec ColorSpace ET dimensions minimales
            newDoc = app.documents.add(colorSpace, tempSize, tempSize);
            $.writeln("   ✓ Document créé avec ColorSpace: " + (colorSpace === DocumentColorSpace.RGB ? "RGB" : "CMYK"));
            $.writeln("   ✓ Artboard initial: 50×50 points");
        } catch (e) {
            $.writeln("⚠️ Erreur création avec dimensions, essai sans: " + e.toString());
            // Fallback: créer sans dimensions
            newDoc = app.documents.add(colorSpace);
        }

        if (!newDoc) {
            throw new Error("Impossible de créer le nouveau document");
        }

        // Définir les unités
        newDoc.rulerUnits = rulerUnits;

        // 🎯 Appliquer le PPI si spécifié
        var ppi = 72; // Valeur par défaut
        if (documentSettings && documentSettings.ppi) {
            ppi = documentSettings.ppi;
        }

        $.writeln("✓ Nouveau document créé (Untitled*)");
        $.writeln("   Nom suggéré pour la sauvegarde: " + docName + ".ai");
        $.writeln("   ColorSpace: " + (colorSpace === DocumentColorSpace.RGB ? "RGB" : "CMYK"));
        $.writeln("   Résolution: " + ppi + " PPI");

        // 🎯 DÉPLACER l'artboard minimal loin en haut à gauche
        try {
            $.writeln("   Déplacement de l'artboard temporaire...");
            $.writeln("   Nombre d'artboards: " + newDoc.artboards.length);

            var tempArtboard = newDoc.artboards[0];

            // Afficher position actuelle
            var currentRect = tempArtboard.artboardRect;
            $.writeln("   Position AVANT déplacement:");
            $.writeln("     L=" + currentRect[0].toFixed(0) + ", T=" + currentRect[1].toFixed(0) +
                     ", R=" + currentRect[2].toFixed(0) + ", B=" + currentRect[3].toFixed(0));
            $.writeln("     Taille: " + (currentRect[2] - currentRect[0]).toFixed(0) + "×" +
                     (currentRect[1] - currentRect[3]).toFixed(0));

            // Calculer le nouveau rectangle (même taille, nouvelle position)
            var tempX = -15000;
            var tempY = 15000;
            var newRect = [tempX, tempY, tempX + tempSize, tempY - tempSize];

            $.writeln("   Tentative de déplacement vers (-15000, 15000)...");

            // Déplacer l'artboard
            tempArtboard.artboardRect = newRect;
            tempArtboard.name = "TEMP_ARTBOARD";

            // Vérifier le résultat
            var verifyRect = tempArtboard.artboardRect;
            $.writeln("   Position APRÈS déplacement:");
            $.writeln("     L=" + verifyRect[0].toFixed(0) + ", T=" + verifyRect[1].toFixed(0) +
                     ", R=" + verifyRect[2].toFixed(0) + ", B=" + verifyRect[3].toFixed(0));
            $.writeln("     Nom: " + tempArtboard.name);

            // Vérification finale
            if (Math.abs(verifyRect[0] - tempX) < 1 && Math.abs(verifyRect[1] - tempY) < 1) {
                $.writeln("   ✅ Artboard temporaire déplacé avec succès !");
                $.writeln("   💡 Position: (-15000, 15000), Taille: 50×50");
                $.writeln("   💡 Cet artboard sera supprimé à la fin de la génération");
            } else {
                $.writeln("   ⚠️ Le déplacement n'a pas totalement réussi");
                $.writeln("   ℹ️ Artboard actuel: L=" + verifyRect[0].toFixed(0) + ", T=" + verifyRect[1].toFixed(0));

                // Si le déplacement échoue, au moins l'artboard est petit (50×50)
                // Il gênera moins qu'un A4 au centre
                $.writeln("   ℹ️ L'artboard reste petit (50×50), impact minimal sur la génération");
            }

        } catch (e) {
            $.writeln("❌ Erreur lors du déplacement: " + e.toString());
            $.writeln("   L'artboard restera à sa position initiale (mais il est petit: 50×50)");
        }

        return newDoc;

    } catch (e) {
        $.writeln("❌ Erreur lors de la création du nouveau document: " + e.toString());
        return null;
    }
}

/**
 * Fonction utilitaire pour padding des nombres (ex: 5 → "05")
 */
function padZero(num) {
    return num < 10 ? "0" + num : String(num);
}

/**
 * Transfère un élément d'un document source vers un document cible
 * @param {PageItem} element - L'élément à transférer (référence dans sourceDoc)
 * @param {Document} sourceDoc - Le document source
 * @param {Document} targetDoc - Le document cible
 * @param {string} elementName - Nom de l'élément (pour logs)
 * @return {PageItem|null} Nouvelle référence de l'élément dans targetDoc, ou null si erreur
 */
function transferElementToDocument(element, sourceDoc, targetDoc, elementName) {
    try {
        $.writeln("📦 Transfert de l'élément '" + elementName + "' vers le nouveau document...");

        // Validation de l'élément
        var validation = validateElement(element);
        if (!validation.valid) {
            $.writeln("❌ Élément invalide: " + validation.error);
            return null;
        }

        // Sauvegarder la sélection actuelle du document source
        var originalSelection = sourceDoc.selection;

        // Activer le document source
        app.activeDocument = sourceDoc;

        // Dupliquer l'élément pour ne pas toucher à l'original stocké
        var duplicate = element.duplicate();
        duplicate.hidden = false;

        // Sélectionner le duplicate
        sourceDoc.selection = null; // Clear selection
        duplicate.selected = true;

        // Copier dans le clipboard
        app.copy();
        $.writeln("   ✓ Élément copié dans le clipboard");

        // Activer le document cible
        app.activeDocument = targetDoc;

        // Coller dans le document cible
        app.paste();
        $.writeln("   ✓ Élément collé dans le document cible");

        // Récupérer la référence du nouvel élément (devrait être sélectionné après paste)
        var transferred = null;
        if (targetDoc.selection && targetDoc.selection.length > 0) {
            transferred = targetDoc.selection[0];
            $.writeln("   ✓ Référence récupérée dans le document cible");
        } else {
            $.writeln("⚠️ Impossible de récupérer la référence après paste");
            return null;
        }

        // Cacher l'élément transféré (il sera dupliqué et montré lors de la génération)
        transferred.hidden = true;

        // Retourner au document source et nettoyer
        app.activeDocument = sourceDoc;

        // Supprimer le duplicate temporaire du document source
        try {
            duplicate.remove();
            $.writeln("   ✓ Duplicate temporaire nettoyé");
        } catch (e) {
            $.writeln("⚠️ Erreur nettoyage duplicate: " + e.toString());
        }

        // Restaurer la sélection originale
        sourceDoc.selection = originalSelection;

        $.writeln("✅ Transfert de '" + elementName + "' réussi");
        return transferred;

    } catch (e) {
        $.writeln("❌ Erreur lors du transfert de '" + elementName + "': " + e.toString());

        // Tentative de nettoyage en cas d'erreur
        try {
            app.activeDocument = sourceDoc;
            sourceDoc.selection = null;
        } catch (cleanupError) {
            $.writeln("⚠️ Erreur lors du nettoyage après échec: " + cleanupError.toString());
        }

        return null;
    }
}

// Générer les artboards
function generateArtboards(paramsJSON) {
    var sourceDoc = null;
    var targetDoc = null;

    try {
        var params = safeParseJSON(paramsJSON);
        if (!params || !params.selections) {
            return "ERROR: Une erreur s'est produite lors de la lecture des paramètres. Veuillez réessayer.";
        }

        if (params.exportFormats) {
            var anyFmt = params.exportFormats.png || params.exportFormats.jpg || params.exportFormats.svg || params.exportFormats.ai || params.exportFormats.pdf;
            if (anyFmt && (!params.outputFolder || params.outputFolder === "")) {
                return "ERROR: Vous devez choisir un dossier de sortie dans l'onglet Export avant de générer.";
            }
        }

        // 🆕 NOUVEAU : Créer un document dédié pour l'exportation
        $.writeln("🚀 Début de la génération des plans de travail...");

        sourceDoc = app.activeDocument;
        if (!sourceDoc) {
            return "ERROR: Aucun document source actif";
        }

        $.writeln("📄 Document source: " + (sourceDoc.name || "Sans titre"));

        // Créer le nouveau document pour l'exportation
        targetDoc = createExportDocument(sourceDoc, params.documentSettings);
        if (!targetDoc) {
            return "ERROR: Impossible de créer le document d'exportation. Vérifiez que vous avez assez de mémoire.";
        }

        // Transférer les éléments sélectionnés vers le nouveau document
        $.writeln("📦 Transfert des éléments sélectionnés...");

        var transferredSelections = {
            horizontal: null,
            vertical: null,
            icon: null,
            text: null,
            custom1: null,
            custom2: null,
            custom3: null
        };

        // 🎨 Transférer aussi les versions avec custom colors si nécessaire
        var transferredCustomSelections = {
            horizontal: null,
            vertical: null,
            icon: null,
            text: null,
            custom1: null,
            custom2: null,
            custom3: null
        };

        var hasCustomColors = params.colorVariations.custom &&
                             params.customColors &&
                             params.customColors.mapping &&
                             params.customColors.mapping.length > 0;

        var typesList = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
        var transferErrors = [];

        for (var t = 0; t < typesList.length; t++) {
            var selType = typesList[t];

            // 🔍 Debug: Log l'état des sélections
            $.writeln("🔍 Vérification type '" + selType + "': params.selections=" + params.selections[selType] + ", storedSelections=" + (storedSelections[selType] ? "existe" : "null"));

            if (params.selections[selType] && storedSelections[selType]) {
                var typeName;
                if (selType === 'icon') {
                    typeName = 'icône';
                } else if (selType === 'text') {
                    typeName = 'typographie';
                } else if (selType === 'horizontal') {
                    typeName = 'version horizontale';
                } else if (selType === 'vertical') {
                    typeName = 'version verticale';
                } else if (selType.indexOf('custom') === 0) {
                    // Pour les variations custom, extraire le numéro
                    var customNum = selType.replace('custom', '');
                    typeName = 'variation custom ' + customNum;
                } else {
                    typeName = selType;
                }

                $.writeln("➡️ Tentative de transfert de '" + typeName + "' (type: " + selType + ")");

                // Transférer la version normale
                var transferred = transferElementToDocument(
                    storedSelections[selType],
                    sourceDoc,
                    targetDoc,
                    typeName
                );

                if (!transferred) {
                    $.writeln("❌ Échec du transfert de '" + typeName + "'");
                    transferErrors.push(typeName);
                } else {
                    $.writeln("✅ Transfert de '" + typeName + "' réussi");
                    transferredSelections[selType] = transferred;
                }

                // 🎨 Si custom colors activé, créer et transférer une version avec custom colors
                if (hasCustomColors && transferred) {
                    $.writeln("🎨 Application des custom colors sur " + typeName + " AVANT transfert...");

                    // Dupliquer l'élément source
                    var customElement = storedSelections[selType].duplicate();
                    customElement.hidden = false;

                    // Appliquer custom colors dans le document SOURCE
                    var tmpPaths = [];
                    applyCustomColors(customElement, params.customColors.mapping, tmpPaths);
                    for (var j = tmpPaths.length - 1; j >= 0; j--) {
                        try {
                            tmpPaths[j].remove();
                        } catch (e) {}
                    }

                    // Transférer cette version colorée
                    var transferredCustom = transferElementToDocument(
                        customElement,
                        sourceDoc,
                        targetDoc,
                        typeName + " (custom colors)"
                    );

                    // Nettoyer la duplication dans le document source
                    try {
                        customElement.remove();
                    } catch (e) {}

                    if (transferredCustom) {
                        transferredCustomSelections[selType] = transferredCustom;
                        $.writeln("   ✅ Version custom colors de " + typeName + " transférée");
                    }
                }
            }
        }

        // Vérifier s'il y a eu des erreurs de transfert
        if (transferErrors.length > 0) {
            var errorMsg = "Impossible de transférer certains éléments : " + transferErrors.join(", ");
            $.writeln("❌ " + errorMsg);
            // Garder le nouveau document ouvert pour debug (selon 5.B)
            return "ERROR: " + errorMsg + ". Le nouveau document a été conservé pour vérification.";
        }

        $.writeln("✅ Tous les éléments transférés avec succès");

        // 🆕 Utiliser le nouveau document et les références transférées
        var doc = targetDoc;
        var selectionsToUse = transferredSelections;

        // Activer le nouveau document pour la génération
        app.activeDocument = targetDoc;
        var artboardCount = 0;
        // 🎯 Démarrer en haut à gauche (coordonnées modérées pour éviter les plantages)
        var startX = -8000;      // Position X initiale (gauche, modérée)
        var currentX = startX;   // Position X courante
        var currentY = 8000;     // Position Y en haut (modérée)
        var spacing = 50; // Réduit de 100 à 50
        var maxHeight = 0;
        var created = [];
        var artboardsPerRow = 4;

        // Réduire la taille des artboards pour éviter le débordement
        var artboardSize = 600; // Réduit de 1000 à 600

        // ✨ VALIDATION des sélections transférées
        // Note: typesList redéfini ici mais c'est normal (scope local)
        var typesListValidation = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
        for (var i = 0; i < typesListValidation.length; i++) {
            var selType = typesListValidation[i];
            if (params.selections[selType] && selectionsToUse[selType]) {
                var validation = validateElement(selectionsToUse[selType]);
                if (!validation.valid) {
                    $.writeln("⚠️ Sélection '" + selType + "' invalide après transfert: " + validation.error);
                    var typeName;
                    if (selType === 'icon') {
                        typeName = 'icône';
                    } else if (selType === 'text') {
                        typeName = 'typographie';
                    } else if (selType === 'horizontal') {
                        typeName = 'version horizontale';
                    } else if (selType === 'vertical') {
                        typeName = 'version verticale';
                    } else if (selType.indexOf('custom') === 0) {
                        var customNum = selType.replace('custom', '');
                        typeName = 'variation custom ' + customNum;
                    } else {
                        typeName = selType;
                    }
                    return "ERROR: Problème avec la " + typeName + " après transfert : " + validation.error;
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

        // Boucle de génération des artboards
        var typesListGen = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
        for (var i = 0; i < typesListGen.length; i++) {
            var selType = typesListGen[i];
            if (!params.selections[selType] || !selectionsToUse[selType]) continue;

            for (var c = 0; c < colorVariations.length; c++) {
                var colorVar = colorVariations[c];

                // 🎨 Pour custom colors, utiliser la version déjà transférée avec les couleurs appliquées
                var sourceElement = (colorVar.name === "custom" && transferredCustomSelections[selType])
                    ? transferredCustomSelections[selType]
                    : selectionsToUse[selType];

                var element = sourceElement.duplicate();
                element.hidden = false;

                // Appliquer les variations de couleur (sauf custom qui est déjà appliqué)
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
                }
                // 🎨 Custom colors déjà appliquées avant le transfert - rien à faire ici!

                if (params.artboardTypes.fit) {
                    try {
                        var nameFit = selType + "_fit" + colorVar.suffix;
                        var marginFit = params.artboardMargins ? params.artboardMargins.fit : 5;
                        var h = createFitArtboard(doc, element, artboardSize, currentX, currentY, nameFit, false, marginFit);
                        maxHeight = Math.max(maxHeight, h);
                        artboardCount++;
                        created.push({ name: nameFit, type: selType, colorVariation: colorVar.name });

                        if (artboardCount % artboardsPerRow === 0) {
                            currentY -= (maxHeight + spacing);
                            currentX = startX;  // Recommencer à gauche
                            maxHeight = 0;

                            // ✨ PROTECTION: Vérifier qu'on ne dépasse pas les limites du canvas
                            if (currentY - artboardSize < ILLUSTRATOR_MIN_CANVAS) {
                                $.writeln("⚠️ Limite canvas atteinte, arrêt de la génération (trop d'artboards)");
                                element.remove();
                                cleanupHiddenElements();
                                return "ERROR: Trop de plans de travail à créer ! Illustrator ne peut pas en afficher autant. Réduisez le nombre de couleurs ou de types de plans de travail.";
                            }
                        } else {
                            currentX += artboardSize + spacing;
                        }

                        // Si monochromeLight, créer une version avec fond noir
                        if (colorVar.needsBlackBg) {
                            var nameFitBg = selType + "_fit" + colorVar.suffix + "_bg";
                            var marginFit = params.artboardMargins ? params.artboardMargins.fit : 5;
                            var hBg = createFitArtboard(doc, element, artboardSize, currentX, currentY, nameFitBg, true, marginFit);
                            maxHeight = Math.max(maxHeight, hBg);
                            artboardCount++;
                            created.push({ name: nameFitBg, type: selType, colorVariation: colorVar.name });

                            if (artboardCount % artboardsPerRow === 0) {
                                currentY -= (maxHeight + spacing);
                                currentX = startX;  // Recommencer à gauche
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
                        var marginSquare = params.artboardMargins ? params.artboardMargins.square : 10;
                        createSquareArtboard(doc, element, artboardSize, currentX, currentY, nameSq, false, marginSquare);
                        maxHeight = Math.max(maxHeight, artboardSize);
                        artboardCount++;
                        created.push({ name: nameSq, type: selType, colorVariation: colorVar.name });

                        if (artboardCount % artboardsPerRow === 0) {
                            currentY -= (maxHeight + spacing);
                            currentX = startX;  // Recommencer à gauche
                            maxHeight = 0;

                            // ✨ PROTECTION: Vérifier qu'on ne dépasse pas les limites du canvas
                            if (currentY - artboardSize < ILLUSTRATOR_MIN_CANVAS) {
                                $.writeln("⚠️ Limite canvas atteinte, arrêt de la génération (trop d'artboards)");
                                element.remove();
                                cleanupHiddenElements();
                                return "ERROR: Trop de plans de travail à créer ! Illustrator ne peut pas en afficher autant. Réduisez le nombre de couleurs ou de types de plans de travail.";
                            }
                        } else {
                            currentX += artboardSize + spacing;
                        }

                        // Si monochromeLight, créer une version avec fond noir
                        if (colorVar.needsBlackBg) {
                            var nameSqBg = selType + "_square" + colorVar.suffix + "_bg";
                            var marginSquare = params.artboardMargins ? params.artboardMargins.square : 10;
                            createSquareArtboard(doc, element, artboardSize, currentX, currentY, nameSqBg, true, marginSquare);
                            maxHeight = Math.max(maxHeight, artboardSize);
                            artboardCount++;
                            created.push({ name: nameSqBg, type: selType, colorVariation: colorVar.name });

                            if (artboardCount % artboardsPerRow === 0) {
                                currentY -= (maxHeight + spacing);
                                currentX = startX;  // Recommencer à gauche
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

        // 🎨 GÉNÉRATION DES FAVICONS (32x32, uniquement pour icon)
        // ⚠️ FAVICONS : Toujours carré avec 10% de marge, indépendamment des choix utilisateur
        if (params.faviconEnabled && params.selections.icon && selectionsToUse.icon) {
            $.writeln("🌐 Génération des favicons 32x32 (toujours carré, 10% marge)...");

            var faviconSize = 32; // Taille fixe pour favicon
            var faviconMargin = 10; // Marge fixe de 10% pour favicon

            for (var c = 0; c < colorVariations.length; c++) {
                var colorVar = colorVariations[c];

                // Utiliser l'icône avec les couleurs appropriées
                var sourceElement = (colorVar.name === "custom" && transferredCustomSelections.icon)
                    ? transferredCustomSelections.icon
                    : selectionsToUse.icon;

                var element = sourceElement.duplicate();
                element.hidden = false;

                // Appliquer les variations de couleur
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
                }

                // Toujours créer un artboard carré avec 10% de marge pour favicon
                try {
                    var nameSq = "icon_favicon" + colorVar.suffix;
                    createSquareArtboard(doc, element, faviconSize, currentX, currentY, nameSq, false, faviconMargin);
                    maxHeight = Math.max(maxHeight, faviconSize);
                    artboardCount++;
                    created.push({ name: nameSq, type: 'favicon', colorVariation: colorVar.name });

                    if (artboardCount % artboardsPerRow === 0) {
                        currentY -= (maxHeight + spacing);
                        currentX = startX;
                        maxHeight = 0;
                    } else {
                        currentX += faviconSize + spacing;
                    }

                    // Version avec fond noir si monochromeLight
                    if (colorVar.needsBlackBg) {
                        var nameSqBg = "icon_favicon" + colorVar.suffix + "_bg";
                        createSquareArtboard(doc, element, faviconSize, currentX, currentY, nameSqBg, true, faviconMargin);
                        maxHeight = Math.max(maxHeight, faviconSize);
                        artboardCount++;
                        created.push({ name: nameSqBg, type: 'favicon', colorVariation: colorVar.name });

                        if (artboardCount % artboardsPerRow === 0) {
                            currentY -= (maxHeight + spacing);
                            currentX = startX;
                            maxHeight = 0;
                        } else {
                            currentX += faviconSize + spacing;
                        }
                    }
                } catch (e) {
                    $.writeln("Erreur favicon: " + e.toString());
                }

                element.remove();
            }

            $.writeln("✅ Favicons générés");
        }

        // ✨ NETTOYAGE GARANTI (éléments transférés cachés)
        cleanupAllHiddenElements();

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

            // Ajouter la taille custom si activée
            if (params.customSizeEnabled && params.customSize) {
                var customWidth = params.customSize.width || 1000;
                var customHeight = params.customSize.height || 1000;
                activeSizes.push({
                    size: Math.max(customWidth, customHeight),
                    prefix: "custom_" + customWidth + "x" + customHeight + "_",
                    isCustom: true,
                    customWidth: customWidth,
                    customHeight: customHeight
                });
            }

            for (var i = 0; i < created.length; i++) {
                var art = created[i];
                var typeFolder = new Folder(rootPath + "/" + art.type);
                if (!typeFolder.exists) typeFolder.create();
                var colorFolder = new Folder(typeFolder.fsName + "/" + art.colorVariation);
                if (!colorFolder.exists) colorFolder.create();

                // ⚠️ FAVICONS : Export forcé en PNG et SVG uniquement, taille fixe 32px
                if (art.type === 'favicon') {
                    // Pour les favicons, l'artboard fait 32px et on veut l'exporter à 32px (scale 100%)
                    // La formule dans exportArtboard est: scale = (exportSize / 1000) * 100
                    // Pour avoir scale = 100%, on doit passer exportSize = 1000
                    // Cela donnera : scale = (1000 / 1000) * 100 = 100%

                    // PNG
                    var pngFolder = new Folder(colorFolder.fsName + "/PNG");
                    if (!pngFolder.exists) pngFolder.create();
                    exportArtboard(doc, art.name, pngFolder.fsName, "png", 1000);

                    // SVG
                    exportArtboard(doc, art.name, colorFolder.fsName, "svg", 1000);

                    $.writeln("   ✅ Favicon exporté: " + art.name + " (PNG + SVG, 32px à 100% scale)");
                } else {
                    // Export normal pour les autres types
                    for (var fmt in params.exportFormats) {
                        if (!params.exportFormats[fmt]) continue;

                        // 🔧 PDF et SVG créent automatiquement leur sous-dossier via exportForScreens
                        // PNG et JPG nécessitent la création manuelle du dossier
                        var exportPath;
                        if (fmt === "pdf" || fmt === "svg") {
                            // Utiliser directement colorFolder - exportForScreens créera le sous-dossier
                            exportPath = colorFolder.fsName;
                        } else {
                            // Créer le dossier format pour PNG et JPG
                            var fmtFolder = new Folder(colorFolder.fsName + "/" + fmt.toUpperCase());
                            if (!fmtFolder.exists) fmtFolder.create();
                            exportPath = fmtFolder.fsName;
                        }

                        if (fmt === "png" || fmt === "jpg") {
                            for (var s = 0; s < activeSizes.length; s++) {
                                var sz = activeSizes[s];
                                exportArtboardWithPrefix(doc, art.name, exportPath, fmt, sz.size, sz.prefix);
                            }
                        } else {
                            exportArtboard(doc, art.name, exportPath, fmt, artboardSize);
                        }
                    }
                }
            }
        }

        $.writeln("✅ Génération complétée: " + artboardCount + " artboards créés");

        // 🆕 Supprimer l'artboard temporaire maintenant que la génération est terminée
        try {
            var foundTemp = false;
            for (var i = 0; i < doc.artboards.length; i++) {
                if (doc.artboards[i].name === "TEMP_ARTBOARD") {
                    doc.artboards[i].remove();
                    foundTemp = true;
                    $.writeln("   ✓ Artboard temporaire supprimé");
                    break;
                }
            }
            if (!foundTemp) {
                $.writeln("   ℹ️ Artboard temporaire déjà supprimé ou non trouvé");
            }
        } catch (e) {
            $.writeln("   ⚠️ Impossible de supprimer l'artboard temporaire: " + e.toString());
            $.writeln("   (Ce n'est pas grave, il est très loin et ne gêne pas)");
        }

        $.writeln("📄 Le nouveau document 'Untitled*' reste ouvert et actif");
        $.writeln("💡 Sauvegardez-le avec Fichier > Enregistrer (nom suggéré: exportation-logotypes_XXXXXX.ai)");

        // 🆕 Le nouveau document reste actif (décision 1.A)
        // app.activeDocument est déjà targetDoc, pas besoin de changer

        return "SUCCESS:" + artboardCount;

    } catch (e) {
        $.writeln("❌ Erreur critique dans generateArtboards: " + e.toString());

        // 🆕 NETTOYAGE dans le NOUVEAU document (targetDoc)
        if (targetDoc) {
            try {
                app.activeDocument = targetDoc;
                cleanupAllHiddenElements(); // Utiliser la fonction globale, pas celle avec storedSelections
                $.writeln("   ✓ Nettoyage effectué dans le document d'exportation");
            } catch (cleanupError) {
                $.writeln("   ❌ Erreur lors du nettoyage: " + cleanupError.toString());
            }

            // 🆕 Garder le document ouvert pour inspection (décision 5.B)
            // NOTE : L'artboard temporaire n'est PAS supprimé en cas d'erreur
            // Cela permet de voir l'état exact du document au moment de l'erreur
            $.writeln("⚠️ Le document d'exportation a été conservé pour vérification");
            $.writeln("   L'artboard temporaire 'TEMP_ARTBOARD' est visible (loin en haut à gauche)");
            $.writeln("   Vous pouvez le fermer sans sauvegarder si nécessaire");
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
function createFitArtboard(doc, element, width, x, y, name, withBlackBg, marginPercent) {
    try {
        // Marge par défaut: 5%
        if (typeof marginPercent === 'undefined' || marginPercent === null) {
            marginPercent = 5;
        }

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
        // Calculer le scale factor en tenant compte de la marge
        // Si marginPercent = 5%, l'élément occupe 90% de l'artboard (100% - 5% - 5%)
        var contentRatio = 1 - (marginPercent * 2 / 100);
        var targetWidth = finalWidth * contentRatio;
        var scaleFactor = (targetWidth / elementWidth) * 100;
        copy.resize(scaleFactor, scaleFactor, true, true, true, true, scaleFactor, Transformation.TOPLEFT);

        // Mesurer après resize pour centrer
        var resizedBounds = copy.visibleBounds;
        var resizedWidth = resizedBounds[2] - resizedBounds[0];
        var resizedHeight = resizedBounds[1] - resizedBounds[3];

        // Centrer dans l'artboard
        var centerX = artboardRect[0] + (finalWidth - resizedWidth) / 2;
        var centerY = artboardRect[1] - (finalHeight - resizedHeight) / 2;
        copy.position = [centerX, centerY];

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
function createSquareArtboard(doc, element, size, x, y, name, withBlackBg, marginPercent) {
    try {
        // Marge par défaut: 10%
        if (typeof marginPercent === 'undefined' || marginPercent === null) {
            marginPercent = 10;
        }

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

        // Calculer le scale pour que l'élément tienne dans l'artboard avec la marge
        // Si marginPercent = 10%, l'élément occupe 80% de l'artboard (100% - 10% - 10%)
        var contentRatio = 1 - (marginPercent * 2 / 100);
        var maxSize = finalSize * contentRatio;
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

/**
 * Nettoie tous les éléments cachés dans le document actif
 * Utilisé pour nettoyer le nouveau document d'exportation
 */
function cleanupAllHiddenElements() {
    var cleaned = 0;
    var doc = app.activeDocument;

    $.writeln("🧹 Nettoyage de tous les éléments cachés dans le document actif...");

    try {
        // Parcourir tous les éléments du document (récursif)
        var items = doc.pageItems;
        for (var i = items.length - 1; i >= 0; i--) {
            try {
                if (items[i].hidden) {
                    items[i].remove();
                    cleaned++;
                }
            } catch (e) {
                // Élément peut avoir été supprimé par un parent, ignorer
            }
        }

        $.writeln("🧹 Nettoyage terminé: " + cleaned + " élément(s) supprimé(s)");
        return cleaned;

    } catch (e) {
        $.writeln("❌ Erreur lors du nettoyage global: " + e.toString());
        return cleaned;
    }
}

// Nettoyer les éléments cachés temporaires (pour document source avec storedSelections)
function cleanupHiddenElements() {
    var cleaned = 0;
    var errors = 0;
    var skipped = 0;

    $.writeln("🧹 Début du nettoyage des éléments cachés (storedSelections)...");

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

// Fonctions d'exportation
function exportArtboard(doc, artboardName, folderPath, format, exportSize) {
    var idx = -1;
    for (var k = 0; k < doc.artboards.length; k++) {
        if (doc.artboards[k].name === artboardName) { idx = k; break; }
    }
    if (idx < 0) return;
    doc.artboards.setActiveArtboardIndex(idx);

    // Sanitiser le nom de fichier pour éviter les problèmes
    var safeFilename = sanitizeFilename(artboardName);
    var baseFile = folderPath + "/" + safeFilename;

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
            return "ERROR: Vous devez d'abord sélectionner l'icône ET la typographie dans l'onglet Sélection.";
        }

        // ✨ VALIDATION des éléments avant génération
        var iconValidation = validateElement(storedSelections.icon);
        if (!iconValidation.valid) {
            return "ERROR: Problème avec l'icône - " + iconValidation.error;
        }

        var textValidation = validateElement(storedSelections.text);
        if (!textValidation.valid) {
            return "ERROR: Problème avec la typographie - " + textValidation.error;
        }

        var insigne = storedSelections.icon.duplicate();
        var logotype = storedSelections.text.duplicate();
        insigne.hidden = false;
        logotype.hidden = false;

        // 🔧 NORMALISER LES POSITIONS - Déplacer vers zone sûre (0, 0) AVANT tous calculs
        // Cela évite l'erreur AOoC si les éléments de base sont à des positions extrêmes
        var safeX = 0;
        var safeY = 0;

        // Mesurer AVANT déplacement
        var bLogotype = logotype.geometricBounds;
        var logotypeWidth = bLogotype[2] - bLogotype[0];
        var logotypeHeight = bLogotype[1] - bLogotype[3];

        var bInsigne = insigne.geometricBounds;
        var insigneHeight = bInsigne[1] - bInsigne[3];

        // Redimensionner l'insigne
        var third = logotypeHeight / 2.5;
        var targetHeight = logotypeHeight + 2 * third;
        var scale = (targetHeight / insigneHeight) * 100;
        insigne.resize(scale, scale);

        // Mesurer après resize
        var bInsigneNew = insigne.geometricBounds;
        var insigneWidth = bInsigneNew[2] - bInsigneNew[0];
        var insigneHeightNew = bInsigneNew[1] - bInsigneNew[3];

        // ✨ TROUVER POSITION SÛRE pour le nouvel artboard
        var spacing = 100;
        var maxX = 0;

        // Trouver la position la plus à droite des artboards existants
        if (doc.artboards.length > 0) {
            for (var i = 0; i < doc.artboards.length; i++) {
                var ab = doc.artboards[i].artboardRect;
                if (ab[2] > maxX) maxX = ab[2];
            }
        }

        // S'assurer que maxX n'est pas trop grand
        if (maxX > 10000) {
            maxX = 0; // Réinitialiser si trop de décalage
        }

        var startX = maxX + spacing;
        var startY = 0;

        // Centrage horizontal
        var widest = Math.max(insigneWidth, logotypeWidth);
        var centerX = startX + widest / 2;
        var insigneX = centerX - insigneWidth / 2;
        var logotypeX = centerX - logotypeWidth / 2;

        // Position verticale : insigne en haut, texte en bas
        var insigneY = startY;
        var logotypeY = startY - insigneHeightNew - third;

        // Déplacer vers positions calculées
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

        $.writeln("📐 Tentative création artboard vertical: L=" + left.toFixed(0) + ", T=" + top.toFixed(0) + ", R=" + right.toFixed(0) + ", B=" + bottom.toFixed(0));

        // ✨ VALIDATION du rectangle artboard
        var validation = validateArtboardRect(artboardRect);
        if (!validation.valid) {
            $.writeln("❌ Validation échouée: " + validation.error);
            // Nettoyer le groupe créé
            try { group.remove(); } catch(e) {}
            return "ERROR: " + validation.error + " Astuce : rapprochez vos éléments du centre du document (position 0,0) avant de les sélectionner.";
        }

        // Utiliser le rectangle validé (potentiellement corrigé)
        artboardRect = validation.rect;

        var newArtboard = doc.artboards.add(artboardRect);
        newArtboard.name = "version_verticale_tiers";

        // 🎯 Sélectionner le groupe pour l'auto-sélection
        doc.selection = null;
        group.selected = true;

        $.writeln("✓ Version verticale générée avec succès");
        return "OK";

    } catch (e) {
        $.writeln("❌ Erreur generateVerticalVersion: " + e.toString());

        // Traduire les erreurs techniques Illustrator en messages clairs
        var errorMsg = e.toString();
        if (errorMsg.indexOf("1095724867") !== -1 || errorMsg.indexOf("AOoC") !== -1) {
            return "ERROR: Impossible de créer le plan de travail - vos éléments sont trop éloignés du centre du document. Solution : sélectionnez tous vos éléments, puis utilisez Objet > Plan de travail > Adapter aux limites de l'illustration sélectionnée pour les recentrer.";
        } else if (errorMsg.indexOf("locked") !== -1) {
            return "ERROR: Un élément est verrouillé. Déverrouillez tous les calques dans le panneau Calques.";
        } else {
            return "ERROR: Une erreur inattendue s'est produite lors de la création de la version verticale. Vérifiez que vos éléments ne sont pas corrompus.";
        }
    }
}

function generateHorizontalVersion() {
    try {
        if (app.documents.length === 0) return "NO_DOCUMENT";
        var doc = app.activeDocument;

        if (!storedSelections.icon || !storedSelections.text) {
            return "ERROR: Vous devez d'abord sélectionner l'icône ET la typographie dans l'onglet Sélection.";
        }

        // ✨ VALIDATION des éléments avant génération
        var iconValidation = validateElement(storedSelections.icon);
        if (!iconValidation.valid) {
            return "ERROR: Problème avec l'icône - " + iconValidation.error;
        }

        var textValidation = validateElement(storedSelections.text);
        if (!textValidation.valid) {
            return "ERROR: Problème avec la typographie - " + textValidation.error;
        }

        var insigne = storedSelections.icon.duplicate();
        var logotype = storedSelections.text.duplicate();
        insigne.hidden = false;
        logotype.hidden = false;

        // 🔧 NORMALISER LES POSITIONS - Déplacer vers zone sûre (0, 0) AVANT tous calculs
        // Cela évite l'erreur AOoC si les éléments de base sont à des positions extrêmes
        var safeX = 0;
        var safeY = 0;

        // Mesurer AVANT déplacement
        var bLogotype = logotype.geometricBounds;
        var logotypeWidth = bLogotype[2] - bLogotype[0];
        var logotypeHeight = bLogotype[1] - bLogotype[3];

        var bInsigne = insigne.geometricBounds;
        var insigneHeight = bInsigne[1] - bInsigne[3];

        // Redimensionner l'insigne
        var third = logotypeHeight / 3;
        var targetHeight = logotypeHeight + 2 * third;
        var scale = (targetHeight / insigneHeight) * 100;
        insigne.resize(scale, scale);

        // Mesurer après resize
        var bInsigneNew = insigne.geometricBounds;
        var insigneWidth = bInsigneNew[2] - bInsigneNew[0];
        var insigneHeightNew = bInsigneNew[1] - bInsigneNew[3];

        // ✨ TROUVER POSITION SÛRE pour le nouvel artboard
        var spacing = 100;
        var maxX = 0;

        // Trouver la position la plus à droite des artboards existants
        if (doc.artboards.length > 0) {
            for (var i = 0; i < doc.artboards.length; i++) {
                var ab = doc.artboards[i].artboardRect;
                if (ab[2] > maxX) maxX = ab[2];
            }
        }

        // S'assurer que maxX n'est pas trop grand
        if (maxX > 10000) {
            maxX = 0; // Réinitialiser si trop de décalage
        }

        var startX = maxX + spacing;
        var startY = 0;

        // Position horizontale : insigne à gauche, texte à droite
        var insigneX = startX;
        var logotypeX = insigneX + insigneWidth + third;

        // Aligner verticalement (centrage)
        var maxHeight = Math.max(insigneHeightNew, logotypeHeight);
        var insigneY = startY - (maxHeight - insigneHeightNew) / 2;
        var logotypeY = startY - (maxHeight - logotypeHeight) / 2;

        // Déplacer vers positions calculées
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

        $.writeln("📐 Tentative création artboard horizontal: L=" + left.toFixed(0) + ", T=" + top.toFixed(0) + ", R=" + right.toFixed(0) + ", B=" + bottom.toFixed(0));

        // ✨ VALIDATION du rectangle artboard
        var validation = validateArtboardRect(artboardRect);
        if (!validation.valid) {
            $.writeln("❌ Validation échouée: " + validation.error);
            // Nettoyer le groupe créé
            try { group.remove(); } catch(e) {}
            return "ERROR: " + validation.error + " Astuce : rapprochez vos éléments du centre du document (position 0,0) avant de les sélectionner.";
        }

        // Utiliser le rectangle validé (potentiellement corrigé)
        artboardRect = validation.rect;

        var newArtboard = doc.artboards.add(artboardRect);
        newArtboard.name = "version_horizontale_tiers";

        // 🎯 Sélectionner le groupe pour l'auto-sélection
        doc.selection = null;
        group.selected = true;

        $.writeln("✓ Version horizontale générée avec succès");
        return "OK";

    } catch (e) {
        $.writeln("❌ Erreur generateHorizontalVersion: " + e.toString());

        // Traduire les erreurs techniques Illustrator en messages clairs
        var errorMsg = e.toString();
        if (errorMsg.indexOf("1095724867") !== -1 || errorMsg.indexOf("AOoC") !== -1) {
            return "ERROR: Impossible de créer le plan de travail - vos éléments sont trop éloignés du centre du document. Solution : sélectionnez tous vos éléments, puis utilisez Objet > Plan de travail > Adapter aux limites de l'illustration sélectionnée pour les recentrer.";
        } else if (errorMsg.indexOf("locked") !== -1) {
            return "ERROR: Un élément est verrouillé. Déverrouillez tous les calques dans le panneau Calques.";
        } else {
            return "ERROR: Une erreur inattendue s'est produite lors de la création de la version horizontale. Vérifiez que vos éléments ne sont pas corrompus.";
        }
    }
}




function exportArtboardWithPrefix(doc, artboardName, folderPath, format, exportSize, prefix) {
    var idx = -1;
    for (var k = 0; k < doc.artboards.length; k++) {
        if (doc.artboards[k].name === artboardName) { idx = k; break; }
    }
    if (idx < 0) return;
    doc.artboards.setActiveArtboardIndex(idx);

    // Sanitiser le nom de fichier
    var safeFilename = sanitizeFilename(artboardName);
    var baseFile = folderPath + "/" + prefix + safeFilename;

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