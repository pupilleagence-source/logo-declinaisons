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
        
        elementToStore.hidden = true;
        
        if (storedSelections[type]) {
            try {
                storedSelections[type].remove();
            } catch (e) {}
        }
        
        storedSelections[type] = elementToStore;
        
        return "OK";
    } catch (e) {
        return "ERROR: " + e.toString();
    }
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

function convertToBlack(element, rgbColor, tmpPaths) {
    try {
        var color = new RGBColor();
        color.red = rgbColor.r;
        color.green = rgbColor.g;
        color.blue = rgbColor.b;

        applyColorRecursive(element, color, tmpPaths);
        return true;
    } catch (e) {
         $.writeln("Erreur dans convertToBlack : " + e.toString());
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
        alert("Type non géré dans applyColorRecursive: " + item.typename);
    }
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
        var spacing = 100;
        var maxHeight = 0;
        var created = [];
        var artboardsPerRow = 4; // Limiter à 4 artboards par ligne

        var typesList = ['horizontal', 'vertical', 'icon', 'text'];
        var colorVariations = [];

        if (params.colorVariations.original) {
            colorVariations.push({ name: "original", suffix: "" });
        }
        if (params.colorVariations.blackwhite) {
            colorVariations.push({ name: "blackwhite", suffix: "_nb" });
        }
        if (params.colorVariations.black) {
            colorVariations.push({
                name: "black",
                suffix: "_black",
                rgb: hexToRGB(params.colorVariations.blackColor || "#000000")
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
                } else if (colorVar.name === "black") {
                    var tmpPaths = []; // Nouveau : tableau pour les temps
                    convertToBlack(element, colorVar.rgb, tmpPaths);
                    // Nouveau : nettoyage des temps (la couleur stick maintenant)
                    for (var j = tmpPaths.length - 1; j >= 0; j--) {
                        try {
                            tmpPaths[j].remove();
                        } catch (e) {}
                    }
                }

                if (params.artboardTypes.fit) {
                    try {
                        var nameFit = selType + "_fit" + colorVar.suffix;
                        var h = createFitArtboard(doc, element, 1000, currentX, currentY, nameFit);
                        maxHeight = Math.max(maxHeight, h);
                        artboardCount++;
                        created.push({ name: nameFit, type: selType, colorVariation: colorVar.name });

                        if (artboardCount % artboardsPerRow === 0) {
                            currentY -= (maxHeight + spacing);
                            currentX = 0;
                            maxHeight = 0;
                        } else {
                            currentX += 1000 + spacing;
                        }
                    } catch (e) {
                        $.writeln("Erreur fit: " + e.toString());
                    }
                }

                if (params.artboardTypes.square) {
                    try {
                        var nameSq = selType + "_square" + colorVar.suffix;
                        createSquareArtboard(doc, element, 1000, currentX, currentY, nameSq);
                        maxHeight = Math.max(maxHeight, 1000);
                        artboardCount++;
                        created.push({ name: nameSq, type: selType, colorVariation: colorVar.name });

                        if (artboardCount % artboardsPerRow === 0) {
                            currentY -= (maxHeight + spacing);
                            currentX = 0;
                            maxHeight = 0;
                        } else {
                            currentX += 1000 + spacing;
                        }
                    } catch (e) {
                        $.writeln("Erreur square: " + e.toString());
                    }
                }

                element.remove();
            }
        }

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
                        exportArtboard(doc, art.name, fmtFolder.fsName, fmt, 1000);
                    }
                }
            }
        }

        return "SUCCESS:" + artboardCount;

    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

// Créer un artboard fit-content
function createFitArtboard(doc, element, width, x, y, name) {
    try {
        var wasHidden = element.hidden;
        element.hidden = false;
        var bounds = element.visibleBounds;
        var elementWidth = bounds[2] - bounds[0];
        var elementHeight = bounds[1] - bounds[3];
        element.hidden = wasHidden;

        if (elementWidth <= 0) elementWidth = 1;
        if (elementHeight <= 0) elementHeight = 1;

        var ratio = elementHeight / elementWidth;
        var height = width * ratio;

        var artboardRect = [x, y, x + width, y - height];
        var artboard = doc.artboards.add(artboardRect);
        artboard.name = name;

        var copy = element.duplicate();
        copy.hidden = false;
        var scaleFactor = (width / elementWidth) * 100;
        copy.resize(scaleFactor, scaleFactor, true, true, true, true, scaleFactor, Transformation.TOPLEFT);
        copy.position = [x, y];

        return height;
    } catch (e) {
        throw new Error("Erreur createFitArtboard: " + e.toString());
    }
}

// Créer un artboard carré
function createSquareArtboard(doc, element, size, x, y, name) {
    try {
        var artboardRect = [x, y, x + size, y - size];
        var artboard = doc.artboards.add(artboardRect);
        artboard.name = name;

        var wasHidden = element.hidden;
        element.hidden = false;
        var bounds = element.visibleBounds;
        var elementWidth = bounds[2] - bounds[0];
        var elementHeight = bounds[1] - bounds[3];
        element.hidden = wasHidden;

        if (elementWidth <= 0) elementWidth = 1;
        if (elementHeight <= 0) elementHeight = 1;

        var maxSize = size * 0.8;
        var scaleX = maxSize / elementWidth;
        var scaleY = maxSize / elementHeight;
        var scaleFactor = Math.min(scaleX, scaleY) * 100;

        var copy = element.duplicate();
        copy.hidden = false;
        copy.resize(scaleFactor, scaleFactor, true, true, true, true, scaleFactor, Transformation.TOPLEFT);
        var newBounds = copy.visibleBounds;
        var newWidth = newBounds[2] - newBounds[0];
        var newHeight = newBounds[1] - newBounds[3];
        var centerX = x + (size - newWidth) / 2;
        var centerY = y - (size - newHeight) / 2;
        copy.position = [centerX, centerY];

        return size;
    } catch (e) {
        throw new Error("Erreur createSquareArtboard: " + e.toString());
    }
}

// Nettoyer les éléments cachés temporaires
function cleanupHiddenElements() {
    try {
        for (var key in storedSelections) {
            if (storedSelections.hasOwnProperty(key) && storedSelections[key]) {
                try {
                    if (storedSelections[key].hidden) {
                        storedSelections[key].remove();
                    }
                } catch (e) {}
                storedSelections[key] = null;
            }
        }
    } catch (e) {}
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
    if (app.documents.length === 0) return "NO_DOCUMENT";
    var doc = app.activeDocument;

    if (!storedSelections.icon || !storedSelections.text) {
        return "ERROR: Les deux éléments (icône + typographie) doivent être sélectionnés";
    }

    var insigne = storedSelections.icon.duplicate();
    var logotype = storedSelections.text.duplicate();
    insigne.hidden = false;
    logotype.hidden = false;

    var bLogotype = logotype.geometricBounds;
    var logotypeWidth = bLogotype[2] - bLogotype[0];
    var logotypeHeight = bLogotype[1] - bLogotype[3];
    var logotypeTop = bLogotype[1];
    var logotypeBottom = bLogotype[3];

    var bInsigne = insigne.geometricBounds;
    var insigneHeight = bInsigne[1] - bInsigne[3];
    var third = logotypeHeight / 2.5;

    var targetHeight = logotypeHeight + 2 * third;
    var scale = (targetHeight / insigneHeight) * 100;
    insigne.resize(scale, scale);

    var bInsigneNew = insigne.geometricBounds;
    var insigneWidth = bInsigneNew[2] - bInsigneNew[0];
    var insigneHeightNew = bInsigneNew[1] - bInsigneNew[3];

    var spacing = 70;
    var maxX = -Infinity;
    var maxY = -Infinity;

    for (var i = 0; i < doc.artboards.length; i++) {
        var ab = doc.artboards[i].artboardRect;
        if (ab[2] > maxX) maxX = ab[2];
        if (ab[1] > maxY) maxY = ab[1];
    }

    var artboardX = maxX + spacing;

    // Position verticale : insigne au-dessus, texte en dessous
    var topLineAbove = logotypeTop + third;
    var insigneY = topLineAbove;
    var logotypeY = insigneY - insigneHeightNew - third;

    // Centrage horizontal
    var widest = Math.max(insigneWidth, logotypeWidth);
    var centerX = artboardX + 50 + widest / 2;
    var insigneX = centerX - insigneWidth / 2;
    var logotypeX = centerX - logotypeWidth / 2;

    insigne.position = [insigneX, insigneY];
    logotype.position = [logotypeX, logotypeY];

    // Grouper les deux
    var group = doc.groupItems.add();
    insigne.move(group, ElementPlacement.PLACEATEND);
    logotype.move(group, ElementPlacement.PLACEATEND);

    // Créer un plan de travail autour du groupe
    var gb = group.visibleBounds;
    var width = gb[2] - gb[0] + 100;
    var height = gb[1] - gb[3] + 100;

    var artboardRect = [gb[0] - 50, gb[1] + 50, gb[0] - 50 + width, gb[3] - 50];
    doc.artboards.add(artboardRect).name = "version_verticale_tiers";

    return "OK";
}

function generateHorizontalVersion() {
    if (app.documents.length === 0) return "NO_DOCUMENT";
    var doc = app.activeDocument;

    if (!storedSelections.icon || !storedSelections.text) {
        return "ERROR: Les deux éléments (icône + typographie) doivent être sélectionnés";
    }

    var insigne = storedSelections.icon.duplicate();
    var logotype = storedSelections.text.duplicate();
    insigne.hidden = false;
    logotype.hidden = false;

    var bLogotype = logotype.geometricBounds;
    var logotypeWidth = bLogotype[2] - bLogotype[0];
    var logotypeHeight = bLogotype[1] - bLogotype[3];
    var logotypeTop = bLogotype[1];
    var logotypeBottom = bLogotype[3];

    var bInsigne = insigne.geometricBounds;
    var insigneHeight = bInsigne[1] - bInsigne[3];
    var third = logotypeHeight / 3;

    var targetHeight = logotypeHeight + 2 * third;
    var scale = (targetHeight / insigneHeight) * 100;
    insigne.resize(scale, scale);

    var bInsigneNew = insigne.geometricBounds;
    var insigneWidth = bInsigneNew[2] - bInsigneNew[0];

    var topLineAbove = logotypeTop + third;
    var newInsigneY = topLineAbove;

    var spacing = 100;
    var maxX = -Infinity;
    var maxY = -Infinity;

    for (var i = 0; i < doc.artboards.length; i++) {
        var ab = doc.artboards[i].artboardRect;
        if (ab[2] > maxX) maxX = ab[2];
        if (ab[1] > maxY) maxY = ab[1];
    }

    var insigneX = maxX + spacing;
    var logotypeX = insigneX + insigneWidth + third;

    insigne.position = [insigneX, newInsigneY];
    logotype.position = [logotypeX, logotypeTop];

    // Grouper les deux
    var group = doc.groupItems.add();
    insigne.move(group, ElementPlacement.PLACEATEND);
    logotype.move(group, ElementPlacement.PLACEATEND);

    // Créer un plan de travail autour du groupe
    var gb = group.visibleBounds;
    var width = gb[2] - gb[0] + 100;
    var height = gb[1] - gb[3] + 100;

    var artboardRect = [gb[0] - 50, gb[1] + 50, gb[0] - 50 + width, gb[3] - 50];
    doc.artboards.add(artboardRect).name = "version_horizontale_tiers";

    return "OK";
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