// Script Photoshop : redimensionner tous les PSD mockups a 3000px max
// Lancer depuis Photoshop : File > Scripts > Browse > optimize-mockups.jsx

(function() {
    var MAX_SIZE = 3000; // px sur le cote le plus long
    var QUALITY = 12; // Qualite PSD max (pas de perte)

    var mockupsFolder = new Folder(File($.fileName).parent.fsName + '/templates/mockups');
    if (!mockupsFolder.exists) {
        mockupsFolder = Folder.selectDialog('Selectionnez le dossier mockups');
        if (!mockupsFolder) return;
    }

    var psdFiles = mockupsFolder.getFiles('*.psd');
    if (psdFiles.length === 0) {
        alert('Aucun PSD trouve dans ' + mockupsFolder.fsName);
        return;
    }

    var results = [];
    for (var i = 0; i < psdFiles.length; i++) {
        var f = psdFiles[i];
        var doc = app.open(f);
        var w = doc.width.as('px');
        var h = doc.height.as('px');
        var longest = Math.max(w, h);

        if (longest > MAX_SIZE) {
            var ratio = MAX_SIZE / longest;
            var newW = Math.round(w * ratio);
            var newH = Math.round(h * ratio);
            doc.resizeImage(UnitValue(newW, 'px'), UnitValue(newH, 'px'), doc.resolution, ResampleMethod.BICUBICSHARPER);

            // Sauvegarder
            var saveOpts = new PhotoshopSaveOptions();
            saveOpts.layers = true;
            saveOpts.embedColorProfile = true;
            doc.saveAs(f, saveOpts, true, Extension.LOWERCASE);

            results.push(f.name + ': ' + w + 'x' + h + ' -> ' + newW + 'x' + newH);
        } else {
            results.push(f.name + ': ' + w + 'x' + h + ' (OK, pas de resize)');
        }
        doc.close(SaveOptions.DONOTSAVECHANGES);
    }

    alert('Optimisation terminee !\n\n' + results.join('\n'));
})();
