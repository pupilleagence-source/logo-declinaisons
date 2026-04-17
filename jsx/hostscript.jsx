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
 * Convertit n'importe quel type de couleur Illustrator en RGB
 * Utilise un document RGB temporaire pour une conversion précise
 * @param {Color} color - Objet couleur Illustrator (RGBColor, CMYKColor, LabColor, SpotColor, etc.)
 * @return {Object} { r, g, b } avec valeurs 0-255, ou null si échec
 */
function convertAnyColorToRGB(color) {
    if (!color) return null;

    var colorType = color.typename || "";
    $.writeln("   Conversion couleur type: " + colorType);

    // Si c'est déjà RGB, retourner directement
    if (colorType === "RGBColor") {
        return {
            r: Math.round(Math.max(0, Math.min(255, color.red))),
            g: Math.round(Math.max(0, Math.min(255, color.green))),
            b: Math.round(Math.max(0, Math.min(255, color.blue)))
        };
    }

    // Pour tous les autres types, utiliser un document RGB temporaire pour la conversion
    var tempDoc = null;
    var tempItem = null;

    try {
        // Créer un document RGB temporaire (invisible)
        tempDoc = app.documents.add(DocumentColorSpace.RGB, 10, 10);

        // Créer un rectangle temporaire
        tempItem = tempDoc.pathItems.rectangle(5, 0, 5, 5);

        // Appliquer la couleur au rectangle
        // Pour SpotColor, on doit créer un nouveau SpotColor dans le document
        if (colorType === "SpotColor") {
            // Extraire la couleur de base du spot
            var baseColor = color.spot.color;
            $.writeln("   SpotColor base: " + (baseColor.typename || typeof baseColor));

            // Appliquer la couleur de base directement
            tempItem.fillColor = baseColor;
        } else {
            tempItem.fillColor = color;
        }

        // Lire la couleur convertie (le document est RGB, donc la couleur est convertie automatiquement)
        var fillColor = tempItem.fillColor;
        $.writeln("   Couleur après conversion: " + (fillColor.typename || typeof fillColor));

        var result = null;

        if (fillColor.typename === "RGBColor") {
            result = {
                r: Math.round(Math.max(0, Math.min(255, fillColor.red))),
                g: Math.round(Math.max(0, Math.min(255, fillColor.green))),
                b: Math.round(Math.max(0, Math.min(255, fillColor.blue)))
            };
        } else if (fillColor.red !== undefined) {
            // Fallback si typename n'est pas défini mais propriétés RGB existent
            result = {
                r: Math.round(Math.max(0, Math.min(255, fillColor.red))),
                g: Math.round(Math.max(0, Math.min(255, fillColor.green))),
                b: Math.round(Math.max(0, Math.min(255, fillColor.blue)))
            };
        }

        // Nettoyer
        tempItem.remove();
        tempDoc.close(SaveOptions.DONOTSAVECHANGES);

        return result;

    } catch (e) {
        $.writeln("   Erreur conversion: " + e.toString());
        // Nettoyer en cas d'erreur
        try { if (tempItem) tempItem.remove(); } catch (e2) {}
        try { if (tempDoc) tempDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}

        // Fallback: conversion manuelle basique
        return convertColorManually(color);
    }
}

/**
 * Conversion manuelle des couleurs (fallback si la méthode document temporaire échoue)
 */
function convertColorManually(color) {
    if (!color) return null;

    var colorType = color.typename || "";
    var r, g, b;

    if (colorType === "RGBColor") {
        r = color.red;
        g = color.green;
        b = color.blue;
    } else if (colorType === "CMYKColor") {
        var c = color.cyan / 100;
        var m = color.magenta / 100;
        var y = color.yellow / 100;
        var k = color.black / 100;
        r = 255 * (1 - c) * (1 - k);
        g = 255 * (1 - m) * (1 - k);
        b = 255 * (1 - y) * (1 - k);
    } else if (colorType === "GrayColor") {
        var gray = 255 * (1 - color.gray / 100);
        r = g = b = gray;
    } else if (colorType === "LabColor") {
        // Conversion Lab -> RGB
        var L = color.l;
        var A = color.a;
        var B = color.b;

        var fy = (L + 16) / 116;
        var fx = A / 500 + fy;
        var fz = fy - B / 200;

        var delta = 6 / 29;
        var xr = fx > delta ? fx * fx * fx : (fx - 16/116) / 7.787;
        var yr = fy > delta ? fy * fy * fy : (fy - 16/116) / 7.787;
        var zr = fz > delta ? fz * fz * fz : (fz - 16/116) / 7.787;

        var X = xr * 0.95047;
        var Y = yr * 1.0;
        var Z = zr * 1.08883;

        var rLin = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
        var gLin = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
        var bLin = X * 0.0557 + Y * -0.204 + Z * 1.057;

        function gammaCorrect(c) {
            return c > 0.0031308 ? 1.055 * Math.pow(c, 1/2.4) - 0.055 : 12.92 * c;
        }
        r = gammaCorrect(rLin) * 255;
        g = gammaCorrect(gLin) * 255;
        b = gammaCorrect(bLin) * 255;
    } else if (colorType === "SpotColor") {
        return convertColorManually(color.spot.color);
    } else if (color.red !== undefined) {
        r = color.red;
        g = color.green;
        b = color.blue;
    } else {
        return null;
    }

    return {
        r: Math.round(Math.max(0, Math.min(255, r))),
        g: Math.round(Math.max(0, Math.min(255, g))),
        b: Math.round(Math.max(0, Math.min(255, b)))
    };
}

/**
 * Ouvre le sélecteur de couleur NATIF d'Illustrator via app.showColorPicker()
 * Affiche le dialogue natif avec onglets RGB/CMYK/HSB/Grayscale/Web Safe RGB
 * Permet l'utilisation de la pipette pour prélever des couleurs dans Illustrator
 * @param {string} initialColorHex - Couleur initiale en format hex (ex: "#FF0000")
 * @return {string} "COLOR:#RRGGBB", "CANCELLED" si annulé, ou "ERROR:..." en cas d'erreur
 */
function openColorPickerDialog(initialColorHex) {
    try {
        // Créer un objet RGBColor pour la couleur initiale
        var initialColor = new RGBColor();

        // Convertir hex en RGB (ex: "#FF0000" -> r:255, g:0, b:0)
        if (initialColorHex && initialColorHex.charAt(0) === '#') {
            var hex = initialColorHex.substring(1);
            initialColor.red = parseInt(hex.substring(0, 2), 16);
            initialColor.green = parseInt(hex.substring(2, 4), 16);
            initialColor.blue = parseInt(hex.substring(4, 6), 16);
        } else {
            initialColor.red = 0;
            initialColor.green = 0;
            initialColor.blue = 0;
        }

        // Ouvrir le sélecteur de couleur NATIF d'Illustrator
        var selectedColor = app.showColorPicker(initialColor);

        // L'utilisateur a annulé
        if (!selectedColor || selectedColor === false) {
            return "CANCELLED";
        }

        // Lire les valeurs RGB (showColorPicker retourne toujours un RGBColor)
        var r = Math.round(selectedColor.red);
        var g = Math.round(selectedColor.green);
        var b = Math.round(selectedColor.blue);

        // Clamp 0-255
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        // Convertir en hex string avec padding
        var rHex = ("0" + r.toString(16)).slice(-2);
        var gHex = ("0" + g.toString(16)).slice(-2);
        var bHex = ("0" + b.toString(16)).slice(-2);
        var hexColor = "#" + (rHex + gHex + bHex).toUpperCase();

        $.writeln("   ✅ Couleur sélectionnée: " + hexColor);
        return "COLOR:" + hexColor;

    } catch (e) {
        $.writeln("   ❌ Erreur dans openColorPickerDialog: " + e.toString());
        return "ERROR: " + e.toString();
    }
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
 * Duplique un élément de manière robuste (gère les enfants de groupes complexes)
 * Essaie duplicate() d'abord, puis fallback copy/paste
 */
function safeDuplicate(item) {
    var doc = app.activeDocument;
    // Methode 1 : duplicate vers le calque actif (evite les conflits parent/enfant)
    try {
        var copy = item.duplicate(doc.activeLayer, ElementPlacement.PLACEATEND);
        return copy;
    } catch (e1) {}
    // Methode 2 : duplicate simple
    try {
        var copy = item.duplicate();
        return copy;
    } catch (e2) {}
    // Methode 3 : copy/paste via presse-papier
    try {
        doc.selection = null;
        item.selected = true;
        app.copy();
        app.paste();
        if (doc.selection && doc.selection.length > 0) {
            var pasted = doc.selection[0];
            doc.selection = null;
            return pasted;
        }
    } catch (e3) {}
    return null;
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

// Réinitialiser toutes les sélections stockées
function clearStoredSelections() {
    storedSelections = { icon: null, text: null, horizontal: null, vertical: null, custom1: null, custom2: null, custom3: null };
    return "OK";
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
            // Sauvegarder les références aux éléments sélectionnés AVANT de les dupliquer
            // (car doc.selection peut changer dynamiquement pendant la duplication)
            var selectedItems = [];
            for (var i = 0; i < doc.selection.length; i++) {
                selectedItems.push(doc.selection[i]);
            }

            // Créer un groupe pour les duplicatas
            elementToStore = doc.groupItems.add();

            // Dupliquer chaque élément depuis le tableau sauvegardé
            for (var i = 0; i < selectedItems.length; i++) {
                var itemDuplicate = selectedItems[i].duplicate();
                itemDuplicate.move(elementToStore, ElementPlacement.PLACEATBEGINNING);
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

        // Désélectionner tout dans Illustrator
        doc.selection = null;

        return "OK";
    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

function clearStoredSelection(type) {
    try {
        if (storedSelections[type]) {
            try { storedSelections[type].remove(); } catch (e) {}
            storedSelections[type] = null;
        }
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

// Extraire les couleurs de TOUTES les variations stockées
function extractAllStoredColors() {
    try {
        if (app.documents.length === 0) {
            return "ERROR: NO_DOCUMENT";
        }

        var colorSet = {};
        var maxColors = 30; // Augmenté de 10 à 30 pour couvrir toutes les variations
        var colorCount = 0;
        var analyzedCount = 0;

        // Parcourir toutes les sélections stockées
        var types = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
        for (var t = 0; t < types.length; t++) {
            var type = types[t];
            var element = storedSelections[type];

            if (element) {
                $.writeln("🎨 Analyse des couleurs de : " + type);
                analyzedCount++;
                colorCount = extractColorsRecursive(element, colorSet, colorCount);
                if (colorCount >= maxColors) {
                    $.writeln("⚠️ Limite de " + maxColors + " couleurs atteinte");
                    break;
                }
            }
        }

        if (analyzedCount === 0) {
            return "ERROR: Aucune variation sélectionnée. Sélectionnez au moins une variation avant d'analyser les couleurs.";
        }

        $.writeln("✅ Analyse terminée : " + analyzedCount + " variation(s) analysée(s)");

        // Convertir en tableau et limiter
        var colors = [];
        var count = 0;
        for (var hex in colorSet) {
            if (colorSet.hasOwnProperty(hex)) {
                colors.push(hex);
                count++;
                if (count >= maxColors) break;
            }
        }

        $.writeln("🎨 " + colors.length + " couleur(s) unique(s) trouvée(s)");

        // Créer le JSON avec metadata
        var jsonString = '{"colors":[';
        for (var i = 0; i < colors.length; i++) {
            if (i > 0) jsonString += ',';
            jsonString += '"' + colors[i] + '"';
        }
        jsonString += '],"analyzed":' + analyzedCount + '}';

        return "COLORS:" + jsonString;
    } catch (e) {
        $.writeln("❌ Erreur extractAllStoredColors: " + e.toString());
        return "ERROR: " + e.toString();
    }
}

// 🎨 Extraire les couleurs des stops d'un dégradé
function extractGradientStopColors(gradientColor, colorSet, colorCount) {
    try {
        var gradient = gradientColor.gradient;
        for (var s = 0; s < gradient.gradientStops.length; s++) {
            if (colorCount >= 30) break;
            var stop = gradient.gradientStops[s];
            var hex = null;
            if (stop.color.typename === "RGBColor") {
                hex = rgbToHex(stop.color);
            } else if (stop.color.typename === "CMYKColor") {
                hex = cmykToHex(stop.color);
            }
            if (hex && !colorSet[hex]) {
                colorSet[hex] = true;
                colorCount++;
            }
        }
    } catch (e) {
        $.writeln("Erreur extractGradientStopColors: " + e.toString());
    }
    return colorCount;
}

// 🎨 Appliquer un mapping de couleurs custom aux stops d'un dégradé
function applyColorMappingToGradient(gradientColor, colorMapping) {
    try {
        var gradient = gradientColor.gradient;
        for (var s = 0; s < gradient.gradientStops.length; s++) {
            var stop = gradient.gradientStops[s];
            var hex = null;
            if (stop.color.typename === "RGBColor") {
                hex = rgbToHex(stop.color);
            } else if (stop.color.typename === "CMYKColor") {
                hex = cmykToHex(stop.color);
            }
            if (hex) {
                var newHex = findCustomColor(hex, colorMapping);
                if (newHex && newHex !== hex) {
                    stop.color = hexToRGBColor(newHex);
                }
            }
        }
    } catch (e) {
        $.writeln("Erreur applyColorMappingToGradient: " + e.toString());
    }
}

// 🎨 Appliquer une couleur monochrome à tous les stops d'un dégradé
function applyMonochromeToGradient(gradientColor, color) {
    try {
        var gradient = gradientColor.gradient;
        for (var s = 0; s < gradient.gradientStops.length; s++) {
            gradient.gradientStops[s].color = color;
        }
    } catch (e) {
        $.writeln("Erreur applyMonochromeToGradient: " + e.toString());
    }
}

function extractColorsRecursive(item, colorSet, colorCount) {
    if (colorCount >= 30) return colorCount; // Augmenté de 10 à 30

    try {
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                colorCount = extractColorsRecursive(item.pageItems[i], colorSet, colorCount);
                if (colorCount >= 30) break;
            }
        } else if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) {
                colorCount = extractColorsRecursive(item.pathItems[i], colorSet, colorCount);
                if (colorCount >= 30) break;
            }
        } else if (item.typename === "PathItem") {
            // 🎨 Extraire fillColor (RGB, CMYK ou Gradient)
            if (item.filled) {
                var hex = null;
                if (item.fillColor.typename === "RGBColor") {
                    hex = rgbToHex(item.fillColor);
                } else if (item.fillColor.typename === "CMYKColor") {
                    hex = cmykToHex(item.fillColor);
                } else if (item.fillColor.typename === "GradientColor") {
                    colorCount = extractGradientStopColors(item.fillColor, colorSet, colorCount);
                }

                if (hex && !colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }

            // 🎨 Extraire strokeColor (RGB, CMYK ou Gradient)
            if (colorCount < 30 && item.stroked) {
                var hex = null;
                if (item.strokeColor.typename === "RGBColor") {
                    hex = rgbToHex(item.strokeColor);
                } else if (item.strokeColor.typename === "CMYKColor") {
                    hex = cmykToHex(item.strokeColor);
                } else if (item.strokeColor.typename === "GradientColor") {
                    colorCount = extractGradientStopColors(item.strokeColor, colorSet, colorCount);
                }

                if (hex && !colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }
        } else if (item.typename === "TextFrame") {
            var textRange = item.textRange;

            // 🎨 Extraire fillColor du texte (RGB, CMYK ou Gradient)
            if (textRange.characterAttributes.fillColor) {
                var fillColorType = textRange.characterAttributes.fillColor.typename;
                var hex = null;

                if (fillColorType === "RGBColor") {
                    hex = rgbToHex(textRange.characterAttributes.fillColor);
                } else if (fillColorType === "CMYKColor") {
                    hex = cmykToHex(textRange.characterAttributes.fillColor);
                } else if (fillColorType === "GradientColor") {
                    colorCount = extractGradientStopColors(textRange.characterAttributes.fillColor, colorSet, colorCount);
                }

                if (hex && !colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }

            // 🎨 Extraire strokeColor du texte (RGB, CMYK ou Gradient)
            if (colorCount < 30 && textRange.characterAttributes.strokeColor) {
                var strokeColorType = textRange.characterAttributes.strokeColor.typename;
                var hex = null;

                if (strokeColorType === "RGBColor") {
                    hex = rgbToHex(textRange.characterAttributes.strokeColor);
                } else if (strokeColorType === "CMYKColor") {
                    hex = cmykToHex(textRange.characterAttributes.strokeColor);
                } else if (strokeColorType === "GradientColor") {
                    colorCount = extractGradientStopColors(textRange.characterAttributes.strokeColor, colorSet, colorCount);
                }

                if (hex && !colorSet[hex]) {
                    colorSet[hex] = true;
                    colorCount++;
                }
            }
        } else if (item.pageItems && item.pageItems.length > 0) {
            for (var i = 0; i < item.pageItems.length; i++) {
                colorCount = extractColorsRecursive(item.pageItems[i], colorSet, colorCount);
                if (colorCount >= 30) break;
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

            // 🎨 GESTION RGB, CMYK ET GRADIENT pour fillColor
            if (item.filled) {
                if (item.fillColor.typename === "GradientColor") {
                    applyColorMappingToGradient(item.fillColor, colorMapping);
                } else {
                    var hex = null;
                    if (item.fillColor.typename === "RGBColor") {
                        hex = rgbToHex(item.fillColor);
                    } else if (item.fillColor.typename === "CMYKColor") {
                        hex = cmykToHex(item.fillColor);
                    }

                    if (hex) {
                        var newHex = findCustomColor(hex, colorMapping);
                        if (newHex && newHex !== hex) {
                            item.fillColor = hexToRGBColor(newHex);
                        }
                    }
                }
            }

            // 🎨 GESTION RGB, CMYK ET GRADIENT pour strokeColor
            if (item.stroked) {
                if (item.strokeColor.typename === "GradientColor") {
                    applyColorMappingToGradient(item.strokeColor, colorMapping);
                } else {
                    var hex = null;
                    if (item.strokeColor.typename === "RGBColor") {
                        hex = rgbToHex(item.strokeColor);
                    } else if (item.strokeColor.typename === "CMYKColor") {
                        hex = cmykToHex(item.strokeColor);
                    }

                    if (hex) {
                        var newHex = findCustomColor(hex, colorMapping);
                        if (newHex && newHex !== hex) {
                            item.strokeColor = hexToRGBColor(newHex);
                        }
                    }
                }
            }
        } else if (item.typename === "TextFrame") {
            var textRange = item.textRange;

            // 🎨 GESTION RGB, CMYK ET GRADIENT pour fillColor du texte
            if (textRange.characterAttributes.fillColor) {
                var fillColorType = textRange.characterAttributes.fillColor.typename;

                if (fillColorType === "GradientColor") {
                    applyColorMappingToGradient(textRange.characterAttributes.fillColor, colorMapping);
                } else {
                    var hex = null;
                    if (fillColorType === "RGBColor") {
                        hex = rgbToHex(textRange.characterAttributes.fillColor);
                    } else if (fillColorType === "CMYKColor") {
                        hex = cmykToHex(textRange.characterAttributes.fillColor);
                    }

                    if (hex) {
                        var newHex = findCustomColor(hex, colorMapping);
                        if (newHex && newHex !== hex) {
                            textRange.characterAttributes.fillColor = hexToRGBColor(newHex);
                        }
                    }
                }
            }

            // 🎨 GESTION RGB, CMYK ET GRADIENT pour strokeColor du texte
            if (textRange.characterAttributes.strokeColor) {
                var strokeColorType = textRange.characterAttributes.strokeColor.typename;

                if (strokeColorType === "GradientColor") {
                    applyColorMappingToGradient(textRange.characterAttributes.strokeColor, colorMapping);
                } else {
                    var hex = null;
                    if (strokeColorType === "RGBColor") {
                        hex = rgbToHex(textRange.characterAttributes.strokeColor);
                    } else if (strokeColorType === "CMYKColor") {
                        hex = cmykToHex(textRange.characterAttributes.strokeColor);
                    }

                    if (hex) {
                        var newHex = findCustomColor(hex, colorMapping);
                        if (newHex && newHex !== hex) {
                            textRange.characterAttributes.strokeColor = hexToRGBColor(newHex);
                        }
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
                        var marginFit = params.artboardMargins ? params.artboardMargins.fit : 0;
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
                            var marginFit = params.artboardMargins ? params.artboardMargins.fit : 0;
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

        // 🧹 Supprimer tous les artboards qui ne sont pas dans notre liste de créations
        try {
            $.writeln("🧹 Nettoyage des artboards non-générés...");

            // Créer une liste des noms d'artboards générés
            var createdNames = {};
            for (var i = 0; i < created.length; i++) {
                createdNames[created[i].name] = true;
            }

            // Parcourir TOUS les artboards en sens inverse (important pour la suppression)
            var removedCount = 0;
            for (var i = doc.artboards.length - 1; i >= 0; i--) {
                var artboardName = doc.artboards[i].name;

                // Si l'artboard n'est pas dans notre liste de créations, le supprimer
                if (!createdNames[artboardName]) {
                    $.writeln("   Suppression de l'artboard: " + artboardName);
                    doc.artboards[i].remove();
                    removedCount++;
                }
            }

            if (removedCount > 0) {
                $.writeln("   ✅ " + removedCount + " artboard(s) non-générés supprimés");
            } else {
                $.writeln("   ℹ️ Aucun artboard à nettoyer");
            }
        } catch (e) {
            $.writeln("   ⚠️ Erreur lors du nettoyage des artboards: " + e.toString());
            $.writeln("   (Les artboards temporaires peuvent rester mais ne gênent pas)");
        }

        // 💾 Enregistrer le fichier Illustrator dans le dossier d'export si défini
        if (params.outputFolder && params.outputFolder !== "") {
            try {
                var saveFolder = new Folder(params.outputFolder);
                if (saveFolder.exists) {
                    var saveFile = new File(saveFolder.fsName + "/logo-export-variation.ai");
                    var saveOpts = new IllustratorSaveOptions();
                    saveOpts.compatibility = Compatibility.ILLUSTRATOR24; // CC 2020 ou plus récent
                    saveOpts.compressed = true;

                    doc.saveAs(saveFile, saveOpts);
                    $.writeln("💾 Fichier Illustrator enregistré : " + saveFile.fsName);
                } else {
                    $.writeln("⚠️ Le dossier d'export n'existe pas, fichier non enregistré");
                }
            } catch (saveError) {
                $.writeln("⚠️ Impossible d'enregistrer le fichier Illustrator : " + saveError.toString());
                // Ne pas bloquer la génération si la sauvegarde échoue
            }
        } else {
            $.writeln("📄 Le nouveau document 'Untitled*' reste ouvert et actif");
            $.writeln("💡 Sauvegardez-le avec Fichier > Enregistrer (nom suggéré: exportation-logotypes_XXXXXX.ai)");
        }

        // 🆕 Le nouveau document reste actif (décision 1.A)
        // app.activeDocument est déjà targetDoc, pas besoin de changer

        // Zoom pour voir tout le document
        try {
            app.executeMenuCommand('fitall');
        } catch (zoomErr) {}

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
        // Marge par défaut: 0%
        if (typeof marginPercent === 'undefined' || marginPercent === null) {
            marginPercent = 0;
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

        // Dupliquer les éléments (safeDuplicate gère les enfants de groupes)
        var insigne = safeDuplicate(storedSelections.icon);
        var logotype = safeDuplicate(storedSelections.text);
        if (!insigne || !logotype) {
            if (insigne) try { insigne.remove(); } catch(e) {}
            if (logotype) try { logotype.remove(); } catch(e) {}
            return "ERROR: Impossible de dupliquer les éléments. Essayez de dégrouper vos éléments ou de les placer sur le calque principal, puis re-sélectionnez.";
        }
        insigne.hidden = false;
        logotype.hidden = false;

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

        // ✨ TROUVER POSITION SÛRE pour le nouvel artboard (en dessous des existants)
        var spacing = 100;
        var minY = 0;

        // Trouver la position la plus basse des artboards existants
        if (doc.artboards.length > 0) {
            for (var i = 0; i < doc.artboards.length; i++) {
                var ab = doc.artboards[i].artboardRect;
                if (ab[3] < minY) minY = ab[3]; // ab[3] = bottom (le plus négatif = le plus bas)
            }
        }

        var startX = 0;
        var startY = minY - spacing;

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
        try { app.executeMenuCommand('fitall'); } catch(e) {}
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

        // Dupliquer les éléments (safeDuplicate gère les enfants de groupes)
        var insigne = safeDuplicate(storedSelections.icon);
        var logotype = safeDuplicate(storedSelections.text);
        if (!insigne || !logotype) {
            if (insigne) try { insigne.remove(); } catch(e) {}
            if (logotype) try { logotype.remove(); } catch(e) {}
            return "ERROR: Impossible de dupliquer les éléments. Essayez de dégrouper vos éléments ou de les placer sur le calque principal, puis re-sélectionnez.";
        }
        insigne.hidden = false;
        logotype.hidden = false;

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

        // ✨ TROUVER POSITION SÛRE pour le nouvel artboard (en dessous des existants)
        var spacing = 100;
        var minY = 0;

        // Trouver la position la plus basse des artboards existants
        if (doc.artboards.length > 0) {
            for (var i = 0; i < doc.artboards.length; i++) {
                var ab = doc.artboards[i].artboardRect;
                if (ab[3] < minY) minY = ab[3];
            }
        }

        var startX = 0;
        var startY = minY - spacing;

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
        try { app.executeMenuCommand('fitall'); } catch(e) {}
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

/**
 * Active le PlayerDebugMode sur Mac pour permettre les mises à jour automatiques
 * Retourne un objet JSON stringifié avec le résultat
 */
/**
 * Retourne la liste des familles de polices installées (via Illustrator).
 * Les noms retournés sont les family names tels qu'Illustrator/InDesign les connaissent.
 * @return {string} Familles séparées par "|"
 */
function getInstalledFonts() {
    try {
        var fonts = app.textFonts;
        var families = {};
        for (var i = 0; i < fonts.length; i++) {
            families[fonts[i].family] = true;
        }
        var result = [];
        for (var f in families) {
            result.push(f);
        }
        result.sort();
        return result.join('|');
    } catch (e) {
        return '';
    }
}

/**
 * Ouvre un fichier IDML dans InDesign via BridgeTalk et exécute
 * le post-traitement des frames PROHIB (resize à 50% + centrage).
 * @param {string} idmlPath - Chemin absolu vers le fichier IDML
 * @return {string} JSON result
 */
function openInInDesignAndProcess(idmlPath) {
    try {
        // Script qui sera exécuté dans InDesign
        var inddScript =
            'var f = new File("' + idmlPath.replace(/\\/g, '/') + '");' +
            'if (f.exists) {' +
            '    var doc = app.open(f);' +
            '    var count = 0;' +
            '    for (var p = 0; p < doc.pages.length; p++) {' +
            '        var items = doc.pages[p].allPageItems;' +
            '        for (var i = 0; i < items.length; i++) {' +
            '            var frame = items[i];' +
            '            var n = frame.name || "";' +
            '            if (n.indexOf("PROHIB_SHADOW") !== 0 && n.indexOf("PROHIB_COLOR") !== 0) continue;' +
            '            if (!frame.allGraphics || frame.allGraphics.length === 0) continue;' +
            '            var image = frame.allGraphics[0];' +
            '            var fb = frame.geometricBounds;' +
            '            var frameW = fb[3] - fb[1];' +
            '            var frameH = fb[2] - fb[0];' +
            '            var ib = image.geometricBounds;' +
            '            var imgW = ib[3] - ib[1];' +
            '            var imgH = ib[2] - ib[0];' +
            '            var ratio = imgW / imgH;' +
            '            var newW, newH;' +
            '            if (frameW / frameH <= ratio) {' +
            '                newW = frameW * 0.75;' +
            '                newH = newW / ratio;' +
            '            } else {' +
            '                newH = frameH * 0.75;' +
            '                newW = newH * ratio;' +
            '            }' +
            '            var offsetX = fb[1] + (frameW - newW) / 2;' +
            '            var offsetY = fb[0] + (frameH - newH) / 2;' +
            '            image.geometricBounds = [offsetY, offsetX, offsetY + newH, offsetX + newW];' +
            '            count++;' +
            '        }' +
            '    }' +
            '}';

        var bt = new BridgeTalk();
        bt.target = 'indesign';
        bt.body = inddScript;
        bt.send();

        return JSON.stringify({ success: true });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Process PSD mockups in Photoshop, then open IDML in InDesign.
 * Uses BridgeTalk onResult to sequence: Photoshop finishes → InDesign opens.
 *
 * @param {string} idmlPath - Absolute path to the generated IDML file
 * @param {string} mockupDataJson - JSON: {mockups: [{name, filename, path}], logoPath, outputFolder}
 * @return {string} JSON result
 */
function processPhotoshopThenInDesign(idmlPath, mockupDataJson) {
    try {
        var data;
        try {
            data = eval('(' + mockupDataJson + ')');
        } catch (parseErr) {
            return JSON.stringify({ success: false, error: 'JSON parse error: ' + parseErr.toString() });
        }

        // No mockups → skip directly to InDesign
        if (!data.mockups || data.mockups.length === 0) {
            return openInInDesignAndProcess(idmlPath);
        }

        // Les chemins arrivent déjà normalisés en forward slashes depuis main.js
        var mockups = data.mockups;
        var logoPath = data.logoPath;
        var outputFolder = data.outputFolder;

        // Créer les dossiers nécessaires
        var mockupsOutputFolder = new Folder(outputFolder + '/mockups');
        if (!mockupsOutputFolder.exists) {
            mockupsOutputFolder.create();
        }
        var tempFolder = outputFolder + '/_temp';
        var tempFolderObj = new Folder(tempFolder);
        if (!tempFolderObj.exists) {
            tempFolderObj.create();
        }

        // Pré-convertir les logos vectoriels en PNG haute résolution
        // PS gère mal les SVG dans les smart objects
        function convertToPng(srcPath, pngName) {
            try {
                if (!srcPath.match(/\.(svg|ai|pdf|eps)$/i)) return srcPath;
                var origDoc = null;
                try { origDoc = app.activeDocument; } catch (e) {}
                var vecDoc = app.open(new File(srcPath));
                var dest = new File(tempFolder + '/' + pngName);
                var opts = new ExportOptionsPNG24();
                opts.transparency = true;
                opts.antiAliasing = true;
                var maxD = Math.max(vecDoc.width, vecDoc.height);
                opts.horizontalScale = (2000 / maxD) * 100;
                opts.verticalScale = opts.horizontalScale;
                vecDoc.exportFile(dest, ExportType.PNG24, opts);
                vecDoc.close(SaveOptions.DONOTSAVECHANGES);
                try { if (origDoc) app.activeDocument = origDoc; } catch (e) {}
                return tempFolder + '/' + pngName;
            } catch (e) { return srcPath; }
        }

        // Convertir le logo par défaut (horizontal)
        logoPath = convertToPng(logoPath, 'temp-logo.png');

        // Convertir chaque variation de logo
        var logoPaths = data.logoPaths || {};
        var variations = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
        for (var vi = 0; vi < variations.length; vi++) {
            var vName = variations[vi];
            if (logoPaths[vName]) {
                logoPaths[vName] = convertToPng(logoPaths[vName], 'temp-logo-' + vName + '.png');
            }
        }

        // Ecrire un marqueur "démarrage" pour confirmer que la fonction a bien été appelée
        try {
            var startLog = new File(tempFolder + '/mockups-log.txt');
            startLog.open('w');
            startLog.write('AI_STARTED: logoPath=' + logoPath);
            startLog.close();
        } catch (e) {}

        // Ecrire le script PS dans un fichier temporaire pour éviter les problèmes d'échappement
        // Le script utilise des single quotes pour les strings → pas de conflit avec les double quotes
        var nl = '\n';
        // Récupérer les chemins de logos par variation et les couleurs de la marque
        var logoPaths = data.logoPaths || {};
        var brandColors = data.brandColors || [];
        var primaryColor = data.primaryColor || '';
        var darkColor = data.darkColor || primaryColor || '#000000';
        var lightColor = data.lightColor || '#ffffff';
        var brandName = data.brandName || 'Logo';

        var psContent = "(function() {" + nl;
        psContent += "var results = [];" + nl;
        psContent += "var logoPath = '" + logoPath + "';" + nl;
        psContent += "var outputFolder = '" + outputFolder + "';" + nl;
        psContent += "var primaryColor = '" + primaryColor + "';" + nl;
        psContent += "var darkColor = '" + darkColor + "';" + nl;
        psContent += "var lightColor = '" + lightColor + "';" + nl;
        psContent += "var brandName = '" + brandName.replace(/'/g, "\\'") + "';" + nl;

        // Chemins de logos par variation (pour LOGO_HORIZONTAL, LOGO_VERTICAL, etc.)
        psContent += "var logoPaths = {";
        var lpKeys = [];
        for (var lpk in logoPaths) {
            if (logoPaths.hasOwnProperty(lpk)) {
                lpKeys.push("'" + lpk + "':'" + logoPaths[lpk] + "'");
            }
        }
        psContent += lpKeys.join(',');
        psContent += "};" + nl;

        // Couleurs de la marque (pour COLOR_1, COLOR_2, COLOR_3...)
        psContent += "var brandColors = [";
        for (var bci = 0; bci < brandColors.length; bci++) {
            if (bci > 0) psContent += ",";
            psContent += "'" + brandColors[bci] + "'";
        }
        psContent += "];" + nl;
        psContent += "var mockups = [";
        for (var i = 0; i < mockups.length; i++) {
            var m = mockups[i];
            var psdPath = m.path;
            var outputName = m.filename.replace(/\.psd$/i, '.png').toLowerCase();
            if (i > 0) psContent += ",";
            psContent += "{name:'" + m.name + "',psdPath:'" + psdPath + "',outputName:'" + outputName + "'}";
        }
        psContent += "];" + nl;

        psContent += "var mockupsDir = new Folder(outputFolder + '/mockups');" + nl;
        psContent += "if (!mockupsDir.exists) { mockupsDir.create(); }" + nl;

        // Log de démarrage (pas de JSON → pas de problème d'échappement)
        psContent += "try { var lf=new File(outputFolder+'/_temp/mockups-log.txt'); lf.open('w'); lf.write('PS_STARTED: '+mockups.length+' mockups'); lf.close(); } catch(le) {}" + nl;

        // Fonction de debug : lister TOUS les calques du PSD avec indentation
        psContent += "function listAllLayers(container, indent) {" + nl;
        psContent += "    var lines = [];" + nl;
        psContent += "    try { for (var j=0;j<container.artLayers.length;j++) { var l=container.artLayers[j]; lines.push(indent + l.name + ' [' + l.kind + ']'); } } catch(e) {}" + nl;
        psContent += "    try { for (var j=0;j<container.layerSets.length;j++) { var g=container.layerSets[j]; lines.push(indent + g.name + ' [Group]'); var sub=listAllLayers(g, indent+'  '); for (var k=0;k<sub.length;k++) lines.push(sub[k]); } } catch(e) {}" + nl;
        psContent += "    return lines;" + nl;
        psContent += "}" + nl;

        // findLogoLayers : trouve TOUS les smart objects LOGO_* dans le PSD
        // Retourne un tableau [{layer, variation}] où variation = 'horizontal', 'vertical', etc.
        // Supporte : LOGO (=horizontal), LOGO_HORIZONTAL, LOGO_VERTICAL, LOGO_ICON, LOGO_TEXT, LOGO_CUSTOM1-3
        psContent += "function findLogoLayers(container) {" + nl;
        psContent += "    var found = [];" + nl;
        psContent += "    try { for (var j=0;j<container.artLayers.length;j++) {" + nl;
        psContent += "        var l=container.artLayers[j];" + nl;
        psContent += "        if (l.kind!==LayerKind.SMARTOBJECT) continue;" + nl;
        psContent += "        var nm=l.name.toUpperCase().replace(/\\s+/g,'');" + nl;
        psContent += "        if (nm==='LOGO'||nm==='LOGO_HORIZONTAL') found.push({layer:l,variation:'horizontal'});" + nl;
        psContent += "        else if (nm==='LOGO_VERTICAL') found.push({layer:l,variation:'vertical'});" + nl;
        psContent += "        else if (nm==='LOGO_ICON') found.push({layer:l,variation:'icon'});" + nl;
        psContent += "        else if (nm==='LOGO_TEXT') found.push({layer:l,variation:'text'});" + nl;
        psContent += "        else if (nm==='LOGO_CUSTOM1') found.push({layer:l,variation:'custom1'});" + nl;
        psContent += "        else if (nm==='LOGO_CUSTOM2') found.push({layer:l,variation:'custom2'});" + nl;
        psContent += "        else if (nm==='LOGO_CUSTOM3') found.push({layer:l,variation:'custom3'});" + nl;
        psContent += "    } } catch(e) {}" + nl;
        psContent += "    try { for (var j=0;j<container.layerSets.length;j++) {" + nl;
        psContent += "        var sub=findLogoLayers(container.layerSets[j]);" + nl;
        psContent += "        for (var k=0;k<sub.length;k++) found.push(sub[k]);" + nl;
        psContent += "    } } catch(e) {}" + nl;
        psContent += "    return found;" + nl;
        psContent += "}" + nl;

        psContent += "function getAllSmartObjects(container) {" + nl;
        psContent += "    var list=[];" + nl;
        psContent += "    try { for (var j=0;j<container.artLayers.length;j++) { if (container.artLayers[j].kind===LayerKind.SMARTOBJECT) list.push(container.artLayers[j]); } } catch(e) {}" + nl;
        psContent += "    try { for (var j=0;j<container.layerSets.length;j++) { var n=getAllSmartObjects(container.layerSets[j]); for (var k=0;k<n.length;k++) list.push(n[k]); } } catch(e) {}" + nl;
        psContent += "    return list;" + nl;
        psContent += "}" + nl;

        // Résolution du chemin logo avec cascade de fallbacks
        // horizontal → vertical → text → icon → logoPath
        // vertical → horizontal → text → icon → logoPath
        // icon → horizontal → vertical → logoPath
        // text → horizontal → vertical → logoPath
        // custom1-3 → horizontal → vertical → logoPath
        psContent += "function getLogoPath(variation) {" + nl;
        psContent += "    var chains = {" + nl;
        psContent += "        'horizontal': ['horizontal','vertical','text','icon']," + nl;
        psContent += "        'vertical':   ['vertical','horizontal','text','icon']," + nl;
        psContent += "        'icon':       ['icon','horizontal','vertical']," + nl;
        psContent += "        'text':       ['text','horizontal','vertical']," + nl;
        psContent += "        'custom1':    ['custom1','horizontal','vertical']," + nl;
        psContent += "        'custom2':    ['custom2','horizontal','vertical']," + nl;
        psContent += "        'custom3':    ['custom3','horizontal','vertical']" + nl;
        psContent += "    };" + nl;
        psContent += "    var chain = chains[variation] || [variation,'horizontal','vertical'];" + nl;
        psContent += "    for (var ci=0; ci<chain.length; ci++) {" + nl;
        psContent += "        if (logoPaths[chain[ci]]) return logoPaths[chain[ci]];" + nl;
        psContent += "    }" + nl;
        psContent += "    return logoPath;" + nl;
        psContent += "}" + nl;

        // Utilitaires couleur
        psContent += "function hexToRgb(hex) {" + nl;
        psContent += "    hex = hex.replace('#','');" + nl;
        psContent += "    return { r: parseInt(hex.substring(0,2),16), g: parseInt(hex.substring(2,4),16), b: parseInt(hex.substring(4,6),16) };" + nl;
        psContent += "}" + nl;
        psContent += "function applySolidFillColor(layer, rgb) {" + nl;
        psContent += "    try {" + nl;
        psContent += "        layer.visible = true;" + nl;
        psContent += "        app.activeDocument.activeLayer = layer;" + nl;
        psContent += "        var desc = new ActionDescriptor();" + nl;
        psContent += "        var ref = new ActionReference();" + nl;
        psContent += "        ref.putEnumerated(stringIDToTypeID('contentLayer'), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));" + nl;
        psContent += "        desc.putReference(charIDToTypeID('null'), ref);" + nl;
        psContent += "        var fillDesc = new ActionDescriptor();" + nl;
        psContent += "        var colorDesc = new ActionDescriptor();" + nl;
        psContent += "        colorDesc.putDouble(charIDToTypeID('Rd  '), rgb.r);" + nl;
        psContent += "        colorDesc.putDouble(charIDToTypeID('Grn '), rgb.g);" + nl;
        psContent += "        colorDesc.putDouble(charIDToTypeID('Bl  '), rgb.b);" + nl;
        psContent += "        fillDesc.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), colorDesc);" + nl;
        psContent += "        desc.putObject(charIDToTypeID('T   '), stringIDToTypeID('solidColorLayer'), fillDesc);" + nl;
        psContent += "        executeAction(charIDToTypeID('setd'), desc, DialogModes.NO);" + nl;
        psContent += "    } catch(e) {}" + nl;
        psContent += "}" + nl;

        // applyBrandColors : colorise les calques COLOR_1..5, COLOR_DARK, COLOR_LIGHT
        psContent += "function applyBrandColors(container) {" + nl;
        psContent += "    try { for (var j=0; j<container.artLayers.length; j++) {" + nl;
        psContent += "        var l = container.artLayers[j];" + nl;
        psContent += "        if (l.kind !== LayerKind.SOLIDFILL) continue;" + nl;
        psContent += "        var nm = l.name.toUpperCase().replace(/\\s+/g,'');" + nl;
        psContent += "        var hex = '';" + nl;
        // COLOR_1 à COLOR_5 : couleurs custom de la marque
        psContent += "        if (nm === 'COLOR' || nm === 'COLOR_1') { if (brandColors[0]) hex = brandColors[0]; }" + nl;
        psContent += "        else if (nm === 'COLOR_2') { if (brandColors[1]) hex = brandColors[1]; }" + nl;
        psContent += "        else if (nm === 'COLOR_3') { if (brandColors[2]) hex = brandColors[2]; }" + nl;
        psContent += "        else if (nm === 'COLOR_4') { if (brandColors[3]) hex = brandColors[3]; }" + nl;
        psContent += "        else if (nm === 'COLOR_5') { if (brandColors[4]) hex = brandColors[4]; }" + nl;
        // COLOR_DARK : monochrome sombre → fallback COLOR_1 → #000000
        psContent += "        else if (nm === 'COLOR_DARK' || nm === 'COLORDARK') { hex = darkColor; }" + nl;
        // COLOR_LIGHT : monochrome clair → fallback #ffffff
        psContent += "        else if (nm === 'COLOR_LIGHT' || nm === 'COLORLIGHT') { hex = lightColor; }" + nl;
        psContent += "        if (hex) { applySolidFillColor(l, hexToRgb(hex)); }" + nl;
        psContent += "    } } catch(e) {}" + nl;
        psContent += "    try { for (var j=0; j<container.layerSets.length; j++) {" + nl;
        psContent += "        applyBrandColors(container.layerSets[j]);" + nl;
        psContent += "    } } catch(e) {}" + nl;
        psContent += "}" + nl;

        // replaceTextVariables : remplace {{BRAND_NAME}} dans les calques texte
        psContent += "function replaceTextVariables(container) {" + nl;
        psContent += "    try { for (var j=0; j<container.artLayers.length; j++) {" + nl;
        psContent += "        var l = container.artLayers[j];" + nl;
        psContent += "        if (l.kind !== LayerKind.TEXT) continue;" + nl;
        psContent += "        var txt = l.textItem.contents;" + nl;
        psContent += "        if (txt.indexOf('{{BRAND_NAME}}') !== -1) {" + nl;
        psContent += "            l.textItem.contents = txt.replace(/\\{\\{BRAND_NAME\\}\\}/g, brandName);" + nl;
        psContent += "        }" + nl;
        psContent += "    } } catch(e) {}" + nl;
        psContent += "    try { for (var j=0; j<container.layerSets.length; j++) {" + nl;
        psContent += "        replaceTextVariables(container.layerSets[j]);" + nl;
        psContent += "    } } catch(e) {}" + nl;
        psContent += "}" + nl;

        // replaceLogoContent : remplace le contenu du SO (approche de secours fiable)
        psContent += "function replaceLogoContent(lgPath) {" + nl;
        psContent += "    var d=new ActionDescriptor();" + nl;
        psContent += "    d.putPath(charIDToTypeID('null'), new File(lgPath));" + nl;
        psContent += "    d.putInteger(charIDToTypeID('PgNm'), 1);" + nl;
        psContent += "    executeAction(stringIDToTypeID('placedLayerReplaceContents'), d, DialogModes.NO);" + nl;
        psContent += "}" + nl;

        // processSmartObject : entre dans un SO, cherche LOGO_* à l'intérieur,
        // remplace le contenu avec la bonne variation, redimensionne à 75%
        // Retourne true si un LOGO_* a été trouvé et traité
        psContent += "function processSmartObject(soLayer, targetDoc) {" + nl;
        psContent += "    targetDoc.activeLayer = soLayer;" + nl;
        psContent += "    try {" + nl;
        // Entrer dans le SO
        psContent += "        executeAction(stringIDToTypeID('placedLayerEditContents'), new ActionDescriptor(), DialogModes.NO);" + nl;
        psContent += "        var innerDoc = app.activeDocument;" + nl;
        psContent += "        var canvasW = innerDoc.width.as('px');" + nl;
        psContent += "        var canvasH = innerDoc.height.as('px');" + nl;
        // Chercher LOGO_* à l'intérieur
        psContent += "        var innerLogos = findLogoLayers(innerDoc);" + nl;
        psContent += "        if (innerLogos.length === 0) {" + nl;
        // Pas de LOGO_* dedans → fermer sans sauver, ce n'est pas un SO logo
        psContent += "            innerDoc.close(SaveOptions.DONOTSAVECHANGES);" + nl;
        psContent += "            return {found:false};" + nl;
        psContent += "        }" + nl;
        // Pour chaque LOGO_* trouvé : remplacer son contenu avec la bonne variation
        psContent += "        var replacedVariations = [];" + nl;
        psContent += "        for (var il=0; il<innerLogos.length; il++) {" + nl;
        psContent += "            var inner = innerLogos[il];" + nl;
        psContent += "            var lgp = getLogoPath(inner.variation);" + nl;
        psContent += "            innerDoc.activeLayer = inner.layer;" + nl;
        psContent += "            replaceLogoContent(lgp);" + nl;
        // Redimensionner le calque logo à 75% du canvas du SO parent
        psContent += "            try {" + nl;
        psContent += "                var b = inner.layer.bounds;" + nl;
        psContent += "                var lw = b[2].as('px')-b[0].as('px');" + nl;
        psContent += "                var lh = b[3].as('px')-b[1].as('px');" + nl;
        psContent += "                var tW = canvasW*0.75; var tH = canvasH*0.75;" + nl;
        psContent += "                var scalePct = Math.min(tW/lw, tH/lh)*100;" + nl;
        psContent += "                if (scalePct < 100) {" + nl;
        psContent += "                    inner.layer.resize(scalePct, scalePct, AnchorPosition.MIDDLECENTER);" + nl;
        psContent += "                }" + nl;
        // Centrer dans le canvas du SO
        psContent += "                b = inner.layer.bounds;" + nl;
        psContent += "                lw = b[2].as('px')-b[0].as('px');" + nl;
        psContent += "                lh = b[3].as('px')-b[1].as('px');" + nl;
        psContent += "                var dx = (canvasW-lw)/2 - b[0].as('px');" + nl;
        psContent += "                var dy = (canvasH-lh)/2 - b[1].as('px');" + nl;
        psContent += "                inner.layer.translate(UnitValue(dx,'px'), UnitValue(dy,'px'));" + nl;
        psContent += "            } catch(resErr) {}" + nl;
        psContent += "            replacedVariations.push(inner.variation);" + nl;
        psContent += "        }" + nl;
        // Sauver et fermer le SO (retour au doc principal)
        psContent += "        innerDoc.save();" + nl;
        psContent += "        innerDoc.close();" + nl;
        psContent += "        return {found:true, variations:replacedVariations};" + nl;
        psContent += "    } catch(e) {" + nl;
        // Erreur → fermer le doc interne si ouvert
        psContent += "        try { if(app.activeDocument!==targetDoc) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch(ce){}" + nl;
        psContent += "        return {found:false, error:e.toString()};" + nl;
        psContent += "    }" + nl;
        psContent += "}" + nl;

        // replaceDirectly : fallback simple — remplace le contenu du SO directement + resize
        psContent += "function replaceDirectly(layer, lgPath, targetDoc) {" + nl;
        psContent += "    targetDoc.activeLayer = layer;" + nl;
        psContent += "    replaceLogoContent(lgPath);" + nl;
        psContent += "    try {" + nl;
        psContent += "        var b=layer.bounds;" + nl;
        psContent += "        var lw=b[2].as('px')-b[0].as('px');" + nl;
        psContent += "        var lh=b[3].as('px')-b[1].as('px');" + nl;
        psContent += "        var docW=targetDoc.width.as('px');" + nl;
        psContent += "        var docH=targetDoc.height.as('px');" + nl;
        psContent += "        var tW=docW*0.75; var tH=docH*0.75;" + nl;
        psContent += "        var scalePct=Math.min(tW/lw, tH/lh)*100;" + nl;
        psContent += "        if(scalePct<100) layer.resize(scalePct,scalePct,AnchorPosition.MIDDLECENTER);" + nl;
        psContent += "    } catch(e) {}" + nl;
        psContent += "}" + nl;

        psContent += "for (var i=0;i<mockups.length;i++) {" + nl;
        psContent += "    var mockup=mockups[i]; var doc=null;" + nl;
        psContent += "    try {" + nl;
        psContent += "        var psdFile=new File(mockup.psdPath);" + nl;
        psContent += "        if (!psdFile.exists) { results.push({name:mockup.name,success:false,error:'PSD not found'}); continue; }" + nl;
        psContent += "        doc=app.open(psdFile);" + nl;

        // 1. Appliquer les couleurs de la marque aux calques COLOR_1, COLOR_2, etc.
        psContent += "        try { applyBrandColors(doc); } catch(colorErr) {}" + nl;

        // 1b. Remplacer les variables texte ({{BRAND_NAME}})
        psContent += "        try { replaceTextVariables(doc); } catch(txtErr) {}" + nl;

        // 2. Parcourir chaque SmartObject du PSD : entrer dedans, chercher LOGO_*
        psContent += "        var allSOs = getAllSmartObjects(doc);" + nl;
        psContent += "        var processed = false;" + nl;
        psContent += "        var debugInfo = 'SOs:[' + allSOs.length + ']';" + nl;

        psContent += "        for (var si=0; si<allSOs.length; si++) {" + nl;
        psContent += "            var so = allSOs[si];" + nl;
        psContent += "            debugInfo += ' ' + so.name;" + nl;
        psContent += "            var result = processSmartObject(so, doc);" + nl;
        psContent += "            if (result.found) {" + nl;
        psContent += "                debugInfo += '>OK(' + result.variations.join(',') + ')';" + nl;
        psContent += "                processed = true;" + nl;
        psContent += "            } else {" + nl;
        psContent += "                debugInfo += '>skip';" + nl;
        psContent += "            }" + nl;
        psContent += "        }" + nl;

        // Fallback : aucun SO ne contenait de LOGO_* → remplacer le premier SO directement
        psContent += "        if (!processed && allSOs.length > 0) {" + nl;
        psContent += "            debugInfo += ' | FALLBACK: replaceDirectly(' + allSOs[0].name + ')';" + nl;
        psContent += "            replaceDirectly(allSOs[0], logoPath, doc);" + nl;
        psContent += "            processed = true;" + nl;
        psContent += "        }" + nl;

        psContent += "        if (!processed) { doc.close(SaveOptions.DONOTSAVECHANGES); results.push({name:mockup.name,success:false,error:'No smart object found'}); continue; }" + nl;
        // Export PNG
        psContent += "        var pngFile=new File(outputFolder+'/mockups/'+mockup.outputName);" + nl;
        psContent += "        var pngOpts=new ExportOptionsSaveForWeb();" + nl;
        psContent += "        pngOpts.format=SaveDocumentType.PNG; pngOpts.PNG8=false; pngOpts.transparency=true; pngOpts.quality=100;" + nl;
        psContent += "        doc.exportDocument(pngFile,ExportType.SAVEFORWEB,pngOpts);" + nl;
        // Sauvegarder aussi en PSD
        psContent += "        var psdName=mockup.outputName.replace(/\\.png$/i,'.psd');" + nl;
        psContent += "        var psdFile=new File(outputFolder+'/mockups/'+psdName);" + nl;
        psContent += "        var psdOpts=new PhotoshopSaveOptions();" + nl;
        psContent += "        psdOpts.layers=true; psdOpts.embedColorProfile=true;" + nl;
        psContent += "        doc.saveAs(psdFile,psdOpts,true);" + nl;
        psContent += "        doc.close(SaveOptions.DONOTSAVECHANGES); doc=null;" + nl;
        psContent += "        results.push({name:mockup.name,success:true,debug:debugInfo});" + nl;
        psContent += "    } catch(e) {" + nl;
        psContent += "        if (doc) { try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch(e2){} }" + nl;
        psContent += "        results.push({name:mockup.name,success:false,error:e.toString()});" + nl;
        psContent += "    }" + nl;
        psContent += "}" + nl;

        // Log final (texte simple)
        psContent += "try {" + nl;
        psContent += "    var logLines=['RESULTS:']; for (var ri=0;ri<results.length;ri++) { var r=results[ri]; logLines.push(r.name+': '+(r.success?'OK':'FAIL '+(r.error||''))+(r.debug?' | '+r.debug:'')); }" + nl;
        psContent += "    var lf2=new File(outputFolder+'/_temp/mockups-log.txt'); lf2.open('w'); lf2.write(logLines.join('\\n')); lf2.close();" + nl;
        psContent += "} catch(logErr) {}" + nl;


        // À la fin du script PS : envoyer BridgeTalk à InDesign directement depuis PS
        // (les callbacks btPS.onResult dans Illustrator ne fonctionnent pas car le contexte est terminé)
        psContent += "try {" + nl;
        psContent += "    var btID = new BridgeTalk();" + nl;
        psContent += "    btID.target = 'indesign';" + nl;
        psContent += "    btID.body = '$.evalFile(new File(\"" + outputFolder + "/_temp/mockups-id-script.jsx\"))';" + nl;
        psContent += "    btID.send();" + nl;
        psContent += "} catch(btErr) {}" + nl;

        // Fermer PS si il n'était pas ouvert avant (variable injectée par Illustrator)
        psContent += "if (typeof _shouldClosePS !== 'undefined' && _shouldClosePS) {" + nl;
        psContent += "    $.sleep(3000);" + nl;
        psContent += "    app.quit();" + nl;
        psContent += "}" + nl;

        psContent += "return 'OK';" + nl;
        psContent += "})();" + nl;

        // Log de debug : taille du psContent
        try {
            var dbgFile = new File(outputFolder + '/_temp/mockups-build-debug.txt');
            dbgFile.open('w');
            dbgFile.write('psContent length: ' + psContent.length + '\n');
            dbgFile.write('first 200 chars: ' + psContent.substring(0, 200) + '\n');
            dbgFile.write('last 200 chars: ' + psContent.substring(psContent.length - 200) + '\n');
            dbgFile.close();
        } catch (dbgErr) {}

        // Vérifier si PS est déjà ouvert AVANT d'envoyer le BridgeTalk
        var psWasRunning = BridgeTalk.isRunning('photoshop');

        // Ecrire le script PS dans un fichier temporaire
        var psScriptFile = new File(outputFolder + '/_temp/mockups-ps-script.jsx');
        psScriptFile.open('w');
        // Injecter la variable _shouldClosePS avant le script principal
        if (!psWasRunning) {
            psScriptFile.write('var _shouldClosePS = true;\n');
        }
        psScriptFile.write(psContent);
        psScriptFile.close();

        // Ecrire le script InDesign dans un fichier séparé (appelé par PS via BridgeTalk)
        var safeIdmlPath = idmlPath.replace(/\\/g, '/');
        var idScriptFile = new File(outputFolder + '/_temp/mockups-id-script.jsx');
        idScriptFile.open('w');
        idScriptFile.write('(function() {\n');
        idScriptFile.write('var f = new File("' + safeIdmlPath + '");\n');
        idScriptFile.write('if (!f.exists) return;\n');
        idScriptFile.write('var doc = app.open(f);\n');
        idScriptFile.write('var count = 0;\n');
        idScriptFile.write('for (var p = 0; p < doc.pages.length; p++) {\n');
        idScriptFile.write('    var items = doc.pages[p].allPageItems;\n');
        idScriptFile.write('    for (var i = 0; i < items.length; i++) {\n');
        idScriptFile.write('        var frame = items[i];\n');
        idScriptFile.write('        var n = frame.name || "";\n');
        // PROHIB_ frames: resize image to 75% centered
        idScriptFile.write('        if (n.indexOf("PROHIB_SHADOW") === 0 || n.indexOf("PROHIB_COLOR") === 0) {\n');
        idScriptFile.write('            if (!frame.allGraphics || frame.allGraphics.length === 0) continue;\n');
        idScriptFile.write('            var image = frame.allGraphics[0];\n');
        idScriptFile.write('            var fb = frame.geometricBounds;\n');
        idScriptFile.write('            var frameW = fb[3] - fb[1]; var frameH = fb[2] - fb[0];\n');
        idScriptFile.write('            var ib = image.geometricBounds;\n');
        idScriptFile.write('            var imgW = ib[3] - ib[1]; var imgH = ib[2] - ib[0];\n');
        idScriptFile.write('            var ratio = imgW / imgH;\n');
        idScriptFile.write('            var newW, newH;\n');
        idScriptFile.write('            if (frameW / frameH <= ratio) { newW = frameW * 0.75; newH = newW / ratio; }\n');
        idScriptFile.write('            else { newH = frameH * 0.75; newW = newH * ratio; }\n');
        idScriptFile.write('            var offsetX = fb[1] + (frameW - newW) / 2;\n');
        idScriptFile.write('            var offsetY = fb[0] + (frameH - newH) / 2;\n');
        idScriptFile.write('            image.geometricBounds = [offsetY, offsetX, offsetY + newH, offsetX + newW];\n');
        idScriptFile.write('            count++;\n');
        idScriptFile.write('        }\n');
        // MOCKUP_ frames: fit image proportionally within frame
        idScriptFile.write('        if (n.indexOf("MOCKUP_") === 0) {\n');
        idScriptFile.write('            if (!frame.allGraphics || frame.allGraphics.length === 0) continue;\n');
        idScriptFile.write('            try {\n');
        idScriptFile.write('                frame.fit(FitOptions.PROPORTIONALLY);\n');
        idScriptFile.write('                frame.fit(FitOptions.CENTER_CONTENT);\n');
        idScriptFile.write('            } catch(fitErr) {}\n');
        idScriptFile.write('            count++;\n');
        idScriptFile.write('        }\n');
        idScriptFile.write('    }\n');
        idScriptFile.write('}\n');
        // Nettoyer le dossier _temp/ (tous les fichiers intermediaires)
        idScriptFile.write('try {\n');
        idScriptFile.write('    var tmpDir = new Folder("' + outputFolder + '/_temp");\n');
        idScriptFile.write('    if (tmpDir.exists) {\n');
        idScriptFile.write('        var tmpFiles = tmpDir.getFiles();\n');
        idScriptFile.write('        for (var t = 0; t < tmpFiles.length; t++) { tmpFiles[t].remove(); }\n');
        idScriptFile.write('        tmpDir.remove();\n');
        idScriptFile.write('    }\n');
        idScriptFile.write('} catch(cleanErr) {}\n');
        idScriptFile.write('})();\n');
        idScriptFile.close();

        var psScript = '$.evalFile(new File("' + outputFolder + '/_temp/mockups-ps-script.jsx"));';

        // Envoyer à Photoshop (pas de onResult/onError — PS envoie directement à InDesign)
        var btPS = new BridgeTalk();
        btPS.target = 'photoshop';
        btPS.body = psScript;
        btPS.send();

        return JSON.stringify({ success: true, status: 'processing' });

    } catch (e) {
        // Log l'erreur sur disque pour debug
        try {
            var errFile = new File(outputFolder + '/_temp/mockups-error.txt');
            errFile.open('w');
            errFile.write('ERROR: ' + e.toString() + '\nLine: ' + (e.line || 'unknown') + '\nFile: ' + (e.fileName || 'unknown'));
            errFile.close();
        } catch (logErr) {}
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Re-exécute le script PS mockups déjà sur disque + ouvre InDesign
 * Utilise les fichiers générés lors du dernier export (mockups-ps-script.jsx, IDML)
 */
function rerunMockupsFromDisk(outputFolder, idmlPath) {
    try {
        outputFolder = outputFolder.replace(/\\/g, '/');
        idmlPath = idmlPath.replace(/\\/g, '/');

        var psScriptFile = new File(outputFolder + '/_temp/mockups-ps-script.jsx');
        if (!psScriptFile.exists) {
            return JSON.stringify({ success: false, error: 'mockups-ps-script.jsx introuvable dans ' + outputFolder });
        }

        // Pré-convertir le logo si nécessaire (le temp-logo.png existe peut-être déjà)
        var tempLogo = new File(outputFolder + '/_temp/temp-logo.png');
        if (!tempLogo.exists) {
            // Chercher le logo original pour reconvertir
            try {
                var horizOrig = new Folder(outputFolder + '/horizontal/original');
                if (horizOrig.exists) {
                    var svgFiles = horizOrig.getFiles('*.svg');
                    if (svgFiles.length === 0) {
                        var subDirs = horizOrig.getFiles(function(f) { return f instanceof Folder; });
                        for (var sd = 0; sd < subDirs.length && svgFiles.length === 0; sd++) {
                            svgFiles = subDirs[sd].getFiles('*.svg');
                        }
                    }
                    if (svgFiles.length > 0) {
                        var svgDoc = app.open(svgFiles[0]);
                        var pngDest = new File(outputFolder + '/_temp/temp-logo.png');
                        var pngOpts = new ExportOptionsPNG24();
                        pngOpts.transparency = true;
                        pngOpts.antiAliasing = true;
                        var maxDim = Math.max(svgDoc.width, svgDoc.height);
                        var scaleFactor = (2000 / maxDim) * 100;
                        pngOpts.horizontalScale = scaleFactor;
                        pngOpts.verticalScale = scaleFactor;
                        svgDoc.exportFile(pngDest, ExportType.PNG24, pngOpts);
                        svgDoc.close(SaveOptions.DONOTSAVECHANGES);
                    }
                }
            } catch (convErr) {}
        }

        // Réécrire le script InDesign (le chemin IDML peut avoir changé)
        var idScriptFile = new File(outputFolder + '/_temp/mockups-id-script.jsx');
        idScriptFile.open('w');
        idScriptFile.write('(function() {\n');
        idScriptFile.write('var f = new File("' + idmlPath + '");\n');
        idScriptFile.write('if (!f.exists) return;\n');
        idScriptFile.write('var doc = app.open(f);\n');
        idScriptFile.write('for (var p = 0; p < doc.pages.length; p++) {\n');
        idScriptFile.write('    var items = doc.pages[p].allPageItems;\n');
        idScriptFile.write('    for (var i = 0; i < items.length; i++) {\n');
        idScriptFile.write('        var frame = items[i];\n');
        idScriptFile.write('        var n = frame.name || "";\n');
        idScriptFile.write('        if (n.indexOf("PROHIB_SHADOW") === 0 || n.indexOf("PROHIB_COLOR") === 0) {\n');
        idScriptFile.write('            if (!frame.allGraphics || frame.allGraphics.length === 0) continue;\n');
        idScriptFile.write('            var image = frame.allGraphics[0];\n');
        idScriptFile.write('            var fb = frame.geometricBounds;\n');
        idScriptFile.write('            var frameW = fb[3] - fb[1]; var frameH = fb[2] - fb[0];\n');
        idScriptFile.write('            var ib = image.geometricBounds;\n');
        idScriptFile.write('            var imgW = ib[3] - ib[1]; var imgH = ib[2] - ib[0];\n');
        idScriptFile.write('            var ratio = imgW / imgH;\n');
        idScriptFile.write('            var newW, newH;\n');
        idScriptFile.write('            if (frameW / frameH <= ratio) { newW = frameW * 0.75; newH = newW / ratio; }\n');
        idScriptFile.write('            else { newH = frameH * 0.75; newW = newH * ratio; }\n');
        idScriptFile.write('            var offsetX = fb[1] + (frameW - newW) / 2;\n');
        idScriptFile.write('            var offsetY = fb[0] + (frameH - newH) / 2;\n');
        idScriptFile.write('            image.geometricBounds = [offsetY, offsetX, offsetY + newH, offsetX + newW];\n');
        idScriptFile.write('        }\n');
        idScriptFile.write('        if (n.indexOf("MOCKUP_") === 0) {\n');
        idScriptFile.write('            if (!frame.allGraphics || frame.allGraphics.length === 0) continue;\n');
        idScriptFile.write('            try { frame.fit(FitOptions.PROPORTIONALLY); frame.fit(FitOptions.CENTER_CONTENT); } catch(e) {}\n');
        idScriptFile.write('        }\n');
        idScriptFile.write('    }\n');
        idScriptFile.write('}\n');
        // Nettoyer le dossier _temp/ (tous les fichiers intermediaires)
        idScriptFile.write('try {\n');
        idScriptFile.write('    var tmpDir = new Folder("' + outputFolder + '/_temp");\n');
        idScriptFile.write('    if (tmpDir.exists) {\n');
        idScriptFile.write('        var tmpFiles = tmpDir.getFiles();\n');
        idScriptFile.write('        for (var t = 0; t < tmpFiles.length; t++) { tmpFiles[t].remove(); }\n');
        idScriptFile.write('        tmpDir.remove();\n');
        idScriptFile.write('    }\n');
        idScriptFile.write('} catch(cleanErr) {}\n');
        idScriptFile.write('})();\n');
        idScriptFile.close();

        // Le PS script contient déjà le BridgeTalk vers InDesign
        // Réécrire _shouldClosePS selon l'état actuel de PS
        var psWasRunning = BridgeTalk.isRunning('photoshop');
        var psScriptContent = '';
        if (!psWasRunning) {
            psScriptContent = 'var _shouldClosePS = true;\n';
        }
        // Relire le script PS existant (sans le préfixe _shouldClosePS)
        psScriptFile.open('r');
        var existingContent = psScriptFile.read();
        psScriptFile.close();
        // Supprimer l'ancienne ligne _shouldClosePS si elle existe
        existingContent = existingContent.replace(/^var _shouldClosePS\s*=\s*(?:true|false);\n?/m, '');
        psScriptFile.open('w');
        psScriptFile.write(psScriptContent + existingContent);
        psScriptFile.close();

        var psScript = '$.evalFile(new File("' + outputFolder + '/_temp/mockups-ps-script.jsx"));';

        var btPS = new BridgeTalk();
        btPS.target = 'photoshop';
        btPS.body = psScript;
        btPS.send();

        return JSON.stringify({ success: true, status: 'rerunning' });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function enablePlayerDebugMode() {
    try {
        // Détecter si on est sur Mac
        var isMac = $.os.toLowerCase().indexOf('mac') >= 0;

        if (!isMac) {
            return JSON.stringify({
                success: true,
                platform: 'windows',
                message: 'Windows détecté - PlayerDebugMode non requis'
            });
        }

        // Activer pour les différentes versions de CSXS
        var csxsVersions = [
            'com.adobe.CSXS.9',   // CC 2018-2019
            'com.adobe.CSXS.10',  // CC 2020
            'com.adobe.CSXS.11',  // CC 2021+
            'com.adobe.CSXS.12'   // Futures versions
        ];

        var activatedCount = 0;

        for (var i = 0; i < csxsVersions.length; i++) {
            try {
                var command = 'defaults write ' + csxsVersions[i] + ' PlayerDebugMode 1';
                system.callSystem(command);
                activatedCount++;
            } catch (e) {
                // Ignorer les erreurs pour les versions non installées
            }
        }

        if (activatedCount > 0) {
            return JSON.stringify({
                success: true,
                needsRestart: true,
                message: 'PlayerDebugMode activé pour ' + activatedCount + ' version(s) de CSXS'
            });
        } else {
            return JSON.stringify({
                success: false,
                error: 'Aucune version de CSXS trouvée'
            });
        }

    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error.toString()
        });
    }
}