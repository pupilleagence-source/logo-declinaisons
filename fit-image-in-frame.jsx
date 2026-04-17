// fit-image-in-frame.jsx
// Cherche toutes les frames nommées "bloc-image" dans le document actif,
// et redimensionne leur contenu pour fit proportionnel (contain) + centré.

(function () {
    var doc = app.activeDocument;
    var count = 0;

    // Parcourir tous les éléments de toutes les pages
    for (var p = 0; p < doc.pages.length; p++) {
        var items = doc.pages[p].allPageItems;
        for (var i = 0; i < items.length; i++) {
            var frame = items[i];

            if (frame.name !== "bloc-image") continue;
            if (!frame.allGraphics || frame.allGraphics.length === 0) continue;

            var image = frame.allGraphics[0];

            // Bounds de la frame [y1, x1, y2, x2]
            var fb = frame.geometricBounds;
            var frameW = fb[3] - fb[1];
            var frameH = fb[2] - fb[0];

            // Bounds actuels de l'image
            var ib = image.geometricBounds;
            var imgW = ib[3] - ib[1];
            var imgH = ib[2] - ib[0];

            var ratio = imgW / imgH;

            // Contain : fit par largeur ou par hauteur
            var newW, newH;
            if (frameW / frameH <= ratio) {
                newW = frameW;
                newH = frameW / ratio;
            } else {
                newH = frameH;
                newW = frameH * ratio;
            }

            // Centrage dans la frame
            var offsetX = fb[1] + (frameW - newW) / 2;
            var offsetY = fb[0] + (frameH - newH) / 2;

            image.geometricBounds = [offsetY, offsetX, offsetY + newH, offsetX + newW];
            count++;
        }
    }

    alert(count + " image(s) ajustée(s) dans les frames 'bloc-image'.");
})();
