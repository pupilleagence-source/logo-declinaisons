/**
 * IDML Generator — Template-based approach
 * Opens a pre-made InDesign template (.idml), replaces placeholder images
 * and text, removes unused elements, and saves the modified IDML.
 *
 * Uses JSZip (bundled in lib/) and Node.js fs/path modules.
 */

const IDMLGenerator = (function () {
    'use strict';

    const fs = require('fs');
    const nodePath = require('path');

    // ─── XML helpers ───────────────────────────────────────────────

    function escXml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hexToRgbValues(hex) {
        hex = hex.replace('#', '');
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    function rgbToCmyk(r, g, b) {
        var r1 = r / 255;
        var g1 = g / 255;
        var b1 = b / 255;
        var k = 1 - Math.max(r1, g1, b1);
        if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
        var c = Math.round((1 - r1 - k) / (1 - k) * 100);
        var m = Math.round((1 - g1 - k) / (1 - k) * 100);
        var y = Math.round((1 - b1 - k) / (1 - k) * 100);
        return { c: c, m: m, y: y, k: Math.round(k * 100) };
    }

    // ─── Image dimension helpers ────────────────────────────────────

    /**
     * Read image dimensions from file (SVG, PNG).
     * Returns { width, height } in points, or null if unreadable.
     */
    function getImageDimensions(filePath) {
        try {
            var ext = filePath.split('.').pop().toLowerCase();

            if (ext === 'svg') {
                var svgContent = fs.readFileSync(filePath, 'utf8').substring(0, 2000);
                // Try viewBox first
                var vb = svgContent.match(/viewBox="([^"]*)"/i);
                if (vb) {
                    var parts = vb[1].trim().split(/[\s,]+/);
                    if (parts.length >= 4) {
                        return { width: parseFloat(parts[2]), height: parseFloat(parts[3]) };
                    }
                }
                // Fallback to width/height attributes
                var wm = svgContent.match(/<svg[^>]*\bwidth="([\d.]+)/i);
                var hm = svgContent.match(/<svg[^>]*\bheight="([\d.]+)/i);
                if (wm && hm) {
                    return { width: parseFloat(wm[1]), height: parseFloat(hm[1]) };
                }
            }

            if (ext === 'png') {
                var buf = Buffer.alloc(24);
                var fd = fs.openSync(filePath, 'r');
                fs.readSync(fd, buf, 0, 24, 0);
                fs.closeSync(fd);
                // PNG header: width at offset 16, height at offset 20 (big-endian uint32)
                if (buf[0] === 0x89 && buf[1] === 0x50) {
                    return {
                        width: buf.readUInt32BE(16),
                        height: buf.readUInt32BE(20)
                    };
                }
            }

            if (ext === 'jpg' || ext === 'jpeg') {
                // JPEG: scan for SOF0/SOF2 marker to find dimensions
                var jpgBuf = fs.readFileSync(filePath);
                for (var i = 0; i < jpgBuf.length - 8; i++) {
                    if (jpgBuf[i] === 0xFF && (jpgBuf[i + 1] === 0xC0 || jpgBuf[i + 1] === 0xC2)) {
                        return {
                            height: jpgBuf.readUInt16BE(i + 5),
                            width: jpgBuf.readUInt16BE(i + 7)
                        };
                    }
                }
            }

            // PDF/AI: assume square as fallback
            if (ext === 'pdf' || ext === 'ai') {
                return { width: 612, height: 612 }; // Letter-size default
            }
        } catch (e) { /* skip */ }
        return null;
    }

    /**
     * Extract frame bounds from a Rectangle XML element.
     * Reads PathPointType Anchor values to compute { left, top, width, height }.
     */
    function getFrameBounds(rectXml) {
        var anchors = rectXml.match(/Anchor="([^"]*)"/g);
        if (!anchors || anchors.length < 2) return null;

        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < anchors.length; i++) {
            var coords = anchors[i].match(/Anchor="([\d.-]+)\s+([\d.-]+)"/);
            if (coords) {
                var x = parseFloat(coords[1]);
                var y = parseFloat(coords[2]);
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        if (minX === Infinity) return null;
        return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * Compute the actual rendered bounds of a logo placed in a frame.
     * The logo is fit proportionally (contain) and centered.
     * Returns { spread: { left, top, right, bottom }, scaledW, scaledH }
     * in spread coordinates, or null if computation fails.
     */
    function computeLogoRenderedBounds(rectXml, logoFilePath) {
        var frameBounds = getFrameBounds(rectXml);
        var imgDims = getImageDimensions(logoFilePath);
        if (!frameBounds || !imgDims || imgDims.width <= 0 || imgDims.height <= 0) return null;

        var scale = Math.min(frameBounds.width / imgDims.width, frameBounds.height / imgDims.height);
        var scaledW = imgDims.width * scale;
        var scaledH = imgDims.height * scale;

        // Centered position within frame (local coordinates)
        var localLeft = frameBounds.left + (frameBounds.width - scaledW) / 2;
        var localTop = frameBounds.top + (frameBounds.height - scaledH) / 2;

        // Extract ItemTransform to convert local → spread coordinates
        var transformMatch = rectXml.match(/ItemTransform="([^"]*)"/);
        var rtx = 0, rty = 0;
        if (transformMatch) {
            var parts = transformMatch[1].split(/\s+/);
            if (parts.length >= 6) {
                rtx = parseFloat(parts[4]);
                rty = parseFloat(parts[5]);
            }
        }

        return {
            spread: {
                left: localLeft + rtx,
                top: localTop + rty,
                right: localLeft + scaledW + rtx,
                bottom: localTop + scaledH + rty
            },
            scaledW: scaledW,
            scaledH: scaledH
        };
    }

    /**
     * Reposition a named Rectangle element by rewriting its PathPointArray.
     * targetBounds is in spread coordinates { left, top, right, bottom }.
     * Converts to local coordinates using the element's ItemTransform.
     */
    function repositionNamedRect(xml, elementName, targetBounds) {
        var regex = new RegExp(
            '(<Rectangle[^>]*Name="' + elementName + '"[\\s\\S]*?<\\/Rectangle>)', 'g'
        );

        var matchFound = false;
        xml = xml.replace(regex, function(rectXml) {
            matchFound = true;
            // Extract ItemTransform for spread → local conversion
            var tm = rectXml.match(/ItemTransform="([^"]*)"/);
            var rtx = 0, rty = 0;
            if (tm) {
                var p = tm[1].split(/\s+/);
                if (p.length >= 6) {
                    rtx = parseFloat(p[4]);
                    rty = parseFloat(p[5]);
                }
            }

            // Convert spread → local coordinates
            var L = targetBounds.left - rtx;
            var T = targetBounds.top - rty;
            var R = targetBounds.right - rtx;
            var B = targetBounds.bottom - rty;

            // New PathPointArray (4 corners: TL, BL, BR, TR)
            var newPath =
                '<PathPointArray>' +
                '<PathPointType Anchor="' + L.toFixed(2) + ' ' + T.toFixed(2) + '" LeftDirection="' + L.toFixed(2) + ' ' + T.toFixed(2) + '" RightDirection="' + L.toFixed(2) + ' ' + T.toFixed(2) + '" />' +
                '<PathPointType Anchor="' + L.toFixed(2) + ' ' + B.toFixed(2) + '" LeftDirection="' + L.toFixed(2) + ' ' + B.toFixed(2) + '" RightDirection="' + L.toFixed(2) + ' ' + B.toFixed(2) + '" />' +
                '<PathPointType Anchor="' + R.toFixed(2) + ' ' + B.toFixed(2) + '" LeftDirection="' + R.toFixed(2) + ' ' + B.toFixed(2) + '" RightDirection="' + R.toFixed(2) + ' ' + B.toFixed(2) + '" />' +
                '<PathPointType Anchor="' + R.toFixed(2) + ' ' + T.toFixed(2) + '" LeftDirection="' + R.toFixed(2) + ' ' + T.toFixed(2) + '" RightDirection="' + R.toFixed(2) + ' ' + T.toFixed(2) + '" />' +
                '</PathPointArray>';

            return rectXml.replace(/<PathPointArray>[\s\S]*?<\/PathPointArray>/, newPath);
        });

        if (!matchFound) {
            console.log('[ZONE] Warning: element "' + elementName + '" not found in XML');
        }

        return xml;
    }

    /**
     * Reposition a named TextFrame element by modifying its ItemTransform.
     * targetCenter is in spread coordinates { x, y }.
     * The TextFrame is moved so its center is at the target position.
     */
    function repositionTextFrame(xml, elementName, targetCenter) {
        var regex = new RegExp(
            '(<TextFrame[^>]*Name="' + elementName + '"[\\s\\S]*?<\\/TextFrame>)', 'g'
        );

        xml = xml.replace(regex, function(frameXml) {
            // Get current bounds from PathPointArray to calculate center offset
            var pathMatch = frameXml.match(/<PathPointArray>([\s\S]*?)<\/PathPointArray>/);
            if (!pathMatch) return frameXml;

            // Extract current ItemTransform
            var tm = frameXml.match(/ItemTransform="([^"]*)"/);
            var matrix = [1, 0, 0, 1, 0, 0];
            if (tm) {
                var p = tm[1].split(/\s+/);
                for (var i = 0; i < Math.min(p.length, 6); i++) {
                    matrix[i] = parseFloat(p[i]);
                }
            }

            // Parse PathPointArray to get local bounds
            var anchors = pathMatch[1].match(/Anchor="([^"]*)"/g);
            if (!anchors || anchors.length < 2) return frameXml;

            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var i = 0; i < anchors.length; i++) {
                var coords = anchors[i].match(/Anchor="([^ ]+) ([^"]+)"/);
                if (coords) {
                    var x = parseFloat(coords[1]);
                    var y = parseFloat(coords[2]);
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }

            // Current center in spread coordinates
            var localCenterX = (minX + maxX) / 2;
            var localCenterY = (minY + maxY) / 2;
            var currentSpreadX = localCenterX + matrix[4];
            var currentSpreadY = localCenterY + matrix[5];

            // Calculate delta to move to target
            var deltaX = targetCenter.x - currentSpreadX;
            var deltaY = targetCenter.y - currentSpreadY;

            // Update ItemTransform translation
            var newTx = matrix[4] + deltaX;
            var newTy = matrix[5] + deltaY;
            var newTransform = matrix[0] + ' ' + matrix[1] + ' ' + matrix[2] + ' ' + matrix[3] + ' ' +
                newTx.toFixed(2) + ' ' + newTy.toFixed(2);

            return frameXml.replace(/ItemTransform="[^"]*"/, 'ItemTransform="' + newTransform + '"');
        });

        return xml;
    }

    // ─── File scanner ──────────────────────────────────────────────

    /**
     * Find the best available logo file in the output folder.
     * Priority: SVG > AI > PDF > PNG > JPG (vectors ALWAYS before rasters)
     *
     * Scans the entire directory tree to ensure vector files are found
     * regardless of folder structure created by Illustrator's export.
     *
     * Returns a path relative to outputFolder, or null.
     */
    function findLogoFile(outputFolder, selectionName, colorVariation) {
        var baseName = selectionName + '_fit';
        var suffix = '';
        if (colorVariation === 'blackwhite') suffix = '_nb';
        else if (colorVariation === 'monochrome') suffix = '_monochrome';
        else if (colorVariation === 'monochromeLight') suffix = '_monochromeLight';
        else if (colorVariation === 'custom') suffix = '_custom';

        var fileName = baseName + suffix;
        var selDir = nodePath.join(outputFolder, selectionName, colorVariation);

        // Priority order: vectors first, then rasters
        var vectorExts = ['.svg', '.ai', '.pdf'];
        var rasterExts = ['.png', '.jpg', '.jpeg'];

        // Helper: collect all files with given extensions from a directory (non-recursive)
        function collectFiles(dir, extensions) {
            var results = [];
            try {
                if (!fs.existsSync(dir)) return results;
                var entries = fs.readdirSync(dir);
                for (var i = 0; i < entries.length; i++) {
                    var entry = entries[i];
                    var fullPath = nodePath.join(dir, entry);
                    try {
                        if (!fs.statSync(fullPath).isFile()) continue;
                        var lower = entry.toLowerCase();
                        for (var e = 0; e < extensions.length; e++) {
                            if (lower.endsWith(extensions[e])) {
                                results.push({ path: fullPath, ext: extensions[e], priority: e });
                                break;
                            }
                        }
                    } catch (err) { /* skip */ }
                }
            } catch (err) { /* skip */ }
            return results;
        }

        // Helper: collect all subdirectories
        function getSubdirs(dir) {
            var subdirs = [];
            try {
                if (!fs.existsSync(dir)) return subdirs;
                var entries = fs.readdirSync(dir);
                for (var i = 0; i < entries.length; i++) {
                    var fullPath = nodePath.join(dir, entries[i]);
                    try {
                        if (fs.statSync(fullPath).isDirectory()) {
                            subdirs.push(fullPath);
                        }
                    } catch (err) { /* skip */ }
                }
            } catch (err) { /* skip */ }
            return subdirs;
        }

        // 1. Try exact expected filename first (fastest path)
        for (var v = 0; v < vectorExts.length; v++) {
            var exactPath = nodePath.join(selDir, fileName + vectorExts[v]);
            try {
                if (fs.existsSync(exactPath)) {
                    return nodePath.relative(outputFolder, exactPath);
                }
            } catch (e) { /* skip */ }
        }

        // 2. Collect ALL vector files from selDir and ALL subdirectories
        var allVectors = [];

        // Root folder
        allVectors = allVectors.concat(collectFiles(selDir, vectorExts));

        // All subdirectories (including PNG, SVG, 1x, 2x, etc.)
        var subdirs = getSubdirs(selDir);
        for (var s = 0; s < subdirs.length; s++) {
            allVectors = allVectors.concat(collectFiles(subdirs[s], vectorExts));
            // Also check one level deeper (e.g., selDir/1x/SVG/)
            var subsubdirs = getSubdirs(subdirs[s]);
            for (var ss = 0; ss < subsubdirs.length; ss++) {
                allVectors = allVectors.concat(collectFiles(subsubdirs[ss], vectorExts));
            }
        }

        // If ANY vector found, return the best one (SVG > AI > PDF)
        if (allVectors.length > 0) {
            // Sort by priority (lower = better: SVG=0, AI=1, PDF=2)
            allVectors.sort(function(a, b) { return a.priority - b.priority; });
            return nodePath.relative(outputFolder, allVectors[0].path);
        }

        // 3. No vectors found — now look for rasters
        var allRasters = [];

        // Root folder
        allRasters = allRasters.concat(collectFiles(selDir, rasterExts));

        // Subdirectories
        for (var s = 0; s < subdirs.length; s++) {
            allRasters = allRasters.concat(collectFiles(subdirs[s], rasterExts));
            var subsubdirs = getSubdirs(subdirs[s]);
            for (var ss = 0; ss < subsubdirs.length; ss++) {
                allRasters = allRasters.concat(collectFiles(subsubdirs[ss], rasterExts));
            }
        }

        // If ANY raster found, return the best one (PNG > JPG)
        if (allRasters.length > 0) {
            // Sort by priority (lower = better: PNG=0, JPG=1)
            allRasters.sort(function(a, b) { return a.priority - b.priority; });
            return nodePath.relative(outputFolder, allRasters[0].path);
        }

        return null;
    }

    /**
     * Scan the output folder directly (filesystem-based).
     * Returns { logos: {sel: {color: relativePath}}, selNames: [], colorNames: [] }
     */
    function scanAvailableLogos(outputFolder) {
        var knownSelections = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
        var knownColors = ['original', 'blackwhite', 'monochrome', 'monochromeLight', 'custom'];
        var logos = {};
        var selNames = [];
        var colorNames = [];

        var entries;
        try {
            entries = fs.readdirSync(outputFolder);
        } catch (e) {
            return { logos: logos, selNames: selNames, colorNames: colorNames };
        }

        for (var s = 0; s < knownSelections.length; s++) {
            var sel = knownSelections[s];
            if (entries.indexOf(sel) === -1) continue;

            var selPath = nodePath.join(outputFolder, sel);
            try {
                if (!fs.statSync(selPath).isDirectory()) continue;
            } catch (e) { continue; }

            logos[sel] = {};
            var colorEntries;
            try {
                colorEntries = fs.readdirSync(selPath);
            } catch (e) { continue; }

            for (var c = 0; c < knownColors.length; c++) {
                var col = knownColors[c];
                if (colorEntries.indexOf(col) === -1) continue;
                var file = findLogoFile(outputFolder, sel, col);
                if (file) {
                    logos[sel][col] = file;
                    if (colorNames.indexOf(col) === -1) colorNames.push(col);
                }
            }

            if (Object.keys(logos[sel]).length > 0) {
                selNames.push(sel);
            }
        }

        return { logos: logos, selNames: selNames, colorNames: colorNames };
    }

    /**
     * Scan templates/mockups/ folder for PSD files.
     * Returns { mockups: [{name, filename, path}], count }
     */
    function scanAvailableMockups(extensionPath) {
        var mockupsFolder = nodePath.join(extensionPath, 'templates', 'mockups');
        var mockups = [];

        try {
            if (!fs.existsSync(mockupsFolder)) {
                return { mockups: mockups, count: 0 };
            }

            var entries = fs.readdirSync(mockupsFolder);
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                if (!entry.toLowerCase().endsWith('.psd')) continue;

                var basename = entry.substring(0, entry.length - 4);
                var frameName = 'MOCKUP_' + basename.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');

                mockups.push({
                    name: frameName,
                    filename: entry,
                    path: nodePath.join(mockupsFolder, entry)
                });
            }
        } catch (e) {
            console.log('[MOCKUP] Scan error:', e);
        }

        return { mockups: mockups, count: mockups.length };
    }

    // ─── Color & Font processors ────────────────────────────────────

    /**
     * Process Resources/Graphic.xml: replace swatch values.
     * - BRAND_COLOR_N → brand colors from color analysis
     * - BRAND_MONO_DARK → monochrome dark color
     * - BRAND_MONO_LIGHT → monochrome light color
     *
     * Uses Self="Color/..." as regex anchor because it always appears
     * before Space and ColorValue in the IDML attribute order.
     */
    function processGraphicXml(xml, config) {
        var colors = config.colors;

        // Replace BRAND_COLOR_N swatches (original detected colors)
        // and BRAND_CUSTOM_N swatches (user-chosen custom replacement colors)
        if (colors && colors.length > 0) {
            for (var i = 0; i < colors.length; i++) {
                var hexOriginal = colors[i].original || colors[i];
                var hexCustom = colors[i].custom || hexOriginal;
                var idx = i + 1;

                // BRAND_COLOR_N → original detected color
                if (typeof hexOriginal === 'string') {
                    var rgbOrig = hexToRgbValues(hexOriginal);
                    var swatchName = 'BRAND_COLOR_' + idx;

                    var colorRegex = new RegExp(
                        '(<Color[^>]*Self="Color\\/' + swatchName + '"[^>]*\\bColorValue=")[^"]*(")',
                        'g'
                    );
                    xml = xml.replace(colorRegex, '$1' + rgbOrig.r + ' ' + rgbOrig.g + ' ' + rgbOrig.b + '$2');

                    var spaceRegex = new RegExp(
                        '(<Color[^>]*Self="Color\\/' + swatchName + '"[^>]*\\bSpace=")[^"]*(")',
                        'g'
                    );
                    xml = xml.replace(spaceRegex, '$1RGB$2');
                }

                // BRAND_CUSTOM_N → user-chosen custom color
                if (typeof hexCustom === 'string') {
                    var rgbCust = hexToRgbValues(hexCustom);
                    var customSwatchName = 'BRAND_CUSTOM_' + idx;

                    var customColorRegex = new RegExp(
                        '(<Color[^>]*Self="Color\\/' + customSwatchName + '"[^>]*\\bColorValue=")[^"]*(")',
                        'g'
                    );
                    xml = xml.replace(customColorRegex, '$1' + rgbCust.r + ' ' + rgbCust.g + ' ' + rgbCust.b + '$2');

                    var customSpaceRegex = new RegExp(
                        '(<Color[^>]*Self="Color\\/' + customSwatchName + '"[^>]*\\bSpace=")[^"]*(")',
                        'g'
                    );
                    xml = xml.replace(customSpaceRegex, '$1RGB$2');
                }
            }
        }

        // Replace BRAND_MONO_DARK swatch
        if (config.monochromeColor) {
            var monoDark = hexToRgbValues(config.monochromeColor);
            xml = xml.replace(
                /(<Color[^>]*Self="Color\/BRAND_MONO_DARK"[^>]*\bColorValue=")[^"]*(")/g,
                '$1' + monoDark.r + ' ' + monoDark.g + ' ' + monoDark.b + '$2'
            );
            xml = xml.replace(
                /(<Color[^>]*Self="Color\/BRAND_MONO_DARK"[^>]*\bSpace=")[^"]*(")/g,
                '$1RGB$2'
            );
        }

        // Replace BRAND_MONO_LIGHT swatch (case-insensitive: handles "Light", "LIGHT", etc.)
        if (config.monochromeLightColor) {
            var monoLight = hexToRgbValues(config.monochromeLightColor);
            xml = xml.replace(
                /(<Color[^>]*Self="Color\/BRAND_MONO_LIGHT"[^>]*\bColorValue=")[^"]*(")/gi,
                '$1' + monoLight.r + ' ' + monoLight.g + ' ' + monoLight.b + '$2'
            );
            xml = xml.replace(
                /(<Color[^>]*Self="Color\/BRAND_MONO_LIGHT"[^>]*\bSpace=")[^"]*(")/gi,
                '$1RGB$2'
            );
        }

        return xml;
    }

    /**
     * Process Resources/Styles.xml: set AppliedFont in named styles
     * BRAND_PRIMARY and BRAND_SECONDARY with the chosen fonts.
     *
     * InDesign stores AppliedFont in TWO ways:
     *   1. As an XML attribute: AppliedFont="FontName" on the element tag
     *   2. As a Properties child: <Properties><AppliedFont type="string">FontName</AppliedFont></Properties>
     * Both must be handled. We use setFontOnStyle() for each named style.
     */
    function processStylesXml(xml, fontPrimary, fontSecondary) {
        if (fontPrimary) {
            xml = setFontOnStyle(xml, 'BRAND_PRIMARY', fontPrimary);
        }
        // Use fontSecondary if specified, otherwise fallback to fontPrimary
        var secondaryFont = fontSecondary || fontPrimary;
        if (secondaryFont) {
            xml = setFontOnStyle(xml, 'BRAND_SECONDARY', secondaryFont);
        }
        return xml;
    }

    /**
     * Set AppliedFont on a named ParagraphStyle or CharacterStyle.
     * Handles both attribute-level and Properties child-level font definitions.
     */
    function setFontOnStyle(xml, styleName, fontFamily) {
        var escaped = escXml(fontFamily);

        // --- 1. Handle the full element (tag + children) ---
        var elementRegex = new RegExp(
            '(<(?:ParagraphStyle|CharacterStyle)[^>]*Name="' + styleName + '"' +
            '[\\s\\S]*?<\\/(?:ParagraphStyle|CharacterStyle)>)', 'g'
        );

        xml = xml.replace(elementRegex, function(fullElement) {
            var result = fullElement;

            // 1a. Properties child: <AppliedFont type="string">...</AppliedFont>
            if (result.indexOf('<AppliedFont') !== -1) {
                result = result.replace(
                    /<AppliedFont type="string">[^<]*<\/AppliedFont>/,
                    '<AppliedFont type="string">' + escaped + '</AppliedFont>'
                );
            } else if (result.indexOf('<Properties>') !== -1) {
                // Properties exists but no AppliedFont — insert it
                result = result.replace(
                    '<Properties>',
                    '<Properties>\n\t\t\t\t<AppliedFont type="string">' + escaped + '</AppliedFont>'
                );
            } else {
                // No Properties block — insert one before </ParagraphStyle> or </CharacterStyle>
                result = result.replace(
                    /(<\/(?:ParagraphStyle|CharacterStyle)>)/,
                    '\t\t\t<Properties>\n\t\t\t\t<AppliedFont type="string">' + escaped + '</AppliedFont>\n\t\t\t</Properties>\n\t\t$1'
                );
            }

            // 1b. Also set the attribute on the opening tag (belt and suspenders)
            var openTag = result.match(/^<(?:ParagraphStyle|CharacterStyle)[^>]*/);
            if (openTag) {
                var tag = openTag[0];
                if (/\bAppliedFont="/.test(tag)) {
                    result = result.replace(
                        /^(<(?:ParagraphStyle|CharacterStyle)[^>]*\bAppliedFont=")[^"]*(")/,
                        '$1' + escaped + '$2'
                    );
                } else {
                    result = result.replace(
                        /^(<(?:ParagraphStyle|CharacterStyle)[^>]*Name="[^"]*")/,
                        '$1 AppliedFont="' + escaped + '"'
                    );
                }
            }

            return result;
        });

        return xml;
    }

    // ─── Conditional blocks ─────────────────────────────────────────

    /**
     * Remove a named element (Group, Rectangle, TextFrame) from XML.
     * Handles nested elements of the same type via depth counting.
     * The element is identified by Name="blockName" on its opening tag.
     */
    function removeNamedBlock(xml, blockName) {
        var elementTypes = ['Group', 'Rectangle', 'TextFrame'];

        for (var t = 0; t < elementTypes.length; t++) {
            var tag = elementTypes[t];
            var regex = new RegExp('<' + tag + '\\b[^>]*Name="' + blockName + '"', 'g');
            var match;

            while ((match = regex.exec(xml)) !== null) {
                var startIdx = match.index;
                var closeStr = '</' + tag + '>';
                var openStr = '<' + tag;
                var depth = 1;
                var pos = startIdx + match[0].length;

                while (depth > 0 && pos < xml.length) {
                    var nextOpen = xml.indexOf(openStr, pos);
                    var nextClose = xml.indexOf(closeStr, pos);

                    if (nextClose === -1) break; // malformed

                    if (nextOpen !== -1 && nextOpen < nextClose) {
                        var ch = xml[nextOpen + openStr.length];
                        if (ch === ' ' || ch === '>' || ch === '/') {
                            depth++;
                        }
                        pos = nextOpen + openStr.length;
                    } else {
                        depth--;
                        if (depth === 0) {
                            var endIdx = nextClose + closeStr.length;
                            while (endIdx < xml.length && /\s/.test(xml[endIdx])) endIdx++;
                            xml = xml.substring(0, startIdx) + xml.substring(endIdx);
                            regex.lastIndex = startIdx;
                            break;
                        }
                        pos = nextClose + closeStr.length;
                    }
                }
            }
        }

        return xml;
    }

    /**
     * Normalize a hex color for comparison (lowercase, no #).
     */
    function normalizeHex(hex) {
        if (!hex || typeof hex !== 'string') return '';
        return hex.replace('#', '').toLowerCase();
    }

    /**
     * Process conditional blocks in a Spread XML.
     * Removes named blocks whose data is not available:
     *   BLOCK_COLOR_N         → removed if brand color N does not exist
     *   BLOCK_CUSTOM_N        → removed if custom color N is not unique
     *                           (for dedicated custom page when >2 original colors)
     *   BLOCK_CUSTOM_INLINE_N → removed if custom color N is not unique OR >2 original colors
     *                           (for inline display on main page when ≤2 original colors)
     *   BLOCK_LOGO_HORIZONTAL → removed if horizontal logo not exported
     *   BLOCK_LOGO_VERTICAL   → removed if vertical logo not exported
     *   BLOCK_LOGO_ICON       → removed if icon logo not exported
     *   BLOCK_LOGO_TEXT       → removed if text logo not exported
     *   BLOCK_LOGO_CUSTOM1    → removed if custom1 logo not exported
     *   BLOCK_LOGO_CUSTOM2    → removed if custom2 logo not exported
     *   BLOCK_LOGO_CUSTOM3    → removed if custom3 logo not exported
     *
     * Blocks can be Group, Rectangle, or TextFrame elements.
     * Name them in InDesign's Layers panel.
     */
    function processConditionalBlocks(xml, config, scan) {
        var colors = config.colors || [];
        var maxSlots = 10; // support up to 10 color slots

        // Count original colors
        var originalColorCount = 0;
        for (var i = 0; i < colors.length; i++) {
            var orig = colors[i] && (colors[i].original || colors[i]);
            if (orig && typeof orig === 'string') {
                originalColorCount++;
            }
        }

        // Build set of all "known" colors to detect duplicates:
        // - All original brand colors
        // - Monochrome dark color
        // - Monochrome light color
        var knownColors = {};

        // Add original colors
        for (var i = 0; i < colors.length; i++) {
            var orig = colors[i] && (colors[i].original || colors[i]);
            if (orig && typeof orig === 'string') {
                knownColors[normalizeHex(orig)] = true;
            }
        }

        // Add monochrome colors
        if (config.monochromeColor) {
            knownColors[normalizeHex(config.monochromeColor)] = true;
        }
        if (config.monochromeLightColor) {
            knownColors[normalizeHex(config.monochromeLightColor)] = true;
        }

        // Track custom colors we've already shown (to avoid duplicates among customs)
        var shownCustomColors = {};

        for (var i = 1; i <= maxSlots; i++) {
            var colorEntry = colors[i - 1];
            var hasColor = colorEntry && (typeof (colorEntry.original || colorEntry) === 'string');

            // Check if custom color is truly unique
            var hasUniqueCustom = false;
            if (hasColor && colorEntry.custom) {
                var customNorm = normalizeHex(colorEntry.custom);
                var origNorm = normalizeHex(colorEntry.original || colorEntry);

                // Custom is unique if:
                // 1. Different from its original color
                // 2. Not already in known colors (originals + monochrome)
                // 3. Not already shown as another custom
                var isDifferentFromOriginal = customNorm !== origNorm;
                var isNotKnownColor = !knownColors[customNorm];
                var isNotAlreadyShown = !shownCustomColors[customNorm];

                hasUniqueCustom = isDifferentFromOriginal && isNotKnownColor && isNotAlreadyShown;

                if (hasUniqueCustom) {
                    shownCustomColors[customNorm] = true;
                }
            }

            if (!hasColor) {
                xml = removeNamedBlock(xml, 'BLOCK_COLOR_' + i);
            }

            // BLOCK_CUSTOM_N: for dedicated custom page (shown only when >2 original colors)
            if (!hasUniqueCustom || originalColorCount <= 2) {
                xml = removeNamedBlock(xml, 'BLOCK_CUSTOM_' + i);
            }

            // BLOCK_CUSTOM_INLINE_N: for inline on main page (shown only when ≤2 original colors)
            if (!hasUniqueCustom || originalColorCount > 2) {
                xml = removeNamedBlock(xml, 'BLOCK_CUSTOM_INLINE_' + i);
            }
        }

        // Logo variation blocks
        if (scan && scan.logos) {
            var logoTypes = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];
            for (var t = 0; t < logoTypes.length; t++) {
                var type = logoTypes[t];
                var hasLogo = scan.logos[type] && Object.keys(scan.logos[type]).length > 0;
                if (!hasLogo) {
                    xml = removeNamedBlock(xml, 'BLOCK_LOGO_' + type.toUpperCase());
                }
            }
        }

        return xml;
    }

    /**
     * Remove entire spreads (pages) from the IDML based on conditional markers.
     * Place a small element named PAGE_CUSTOM anywhere on a page in InDesign.
     * PAGE_CUSTOM is removed if:
     *   - No unique custom colors were set by the user, OR
     *   - There are ≤2 original brand colors (customs shown inline on main page)
     *
     * Also updates designmap.xml to keep the IDML valid.
     */
    async function processConditionalPages(zip, config) {
        var colors = config.colors || [];

        // Count original colors
        var originalColorCount = 0;
        for (var i = 0; i < colors.length; i++) {
            var orig = colors[i] && (colors[i].original || colors[i]);
            if (orig && typeof orig === 'string') {
                originalColorCount++;
            }
        }

        // Check if any unique custom colors exist (same logic as processConditionalBlocks)
        var knownColors = {};
        for (var i = 0; i < colors.length; i++) {
            var orig = colors[i] && (colors[i].original || colors[i]);
            if (orig && typeof orig === 'string') {
                knownColors[normalizeHex(orig)] = true;
            }
        }
        if (config.monochromeColor) {
            knownColors[normalizeHex(config.monochromeColor)] = true;
        }
        if (config.monochromeLightColor) {
            knownColors[normalizeHex(config.monochromeLightColor)] = true;
        }

        var shownCustomColors = {};
        var hasAnyUniqueCustom = false;
        for (var i = 0; i < colors.length; i++) {
            var colorEntry = colors[i];
            if (colorEntry && colorEntry.custom) {
                var customNorm = normalizeHex(colorEntry.custom);
                var origNorm = normalizeHex(colorEntry.original || colorEntry);
                var isDifferentFromOriginal = customNorm !== origNorm;
                var isNotKnownColor = !knownColors[customNorm];
                var isNotAlreadyShown = !shownCustomColors[customNorm];

                if (isDifferentFromOriginal && isNotKnownColor && isNotAlreadyShown) {
                    hasAnyUniqueCustom = true;
                    shownCustomColors[customNorm] = true;
                }
            }
        }

        // Keep PAGE_CUSTOM only if:
        // - There are unique custom colors AND
        // - There are more than 2 original colors (otherwise customs shown inline)
        if (hasAnyUniqueCustom && originalColorCount > 2) return;

        var allFiles = Object.keys(zip.files);
        var spreadFiles = allFiles.filter(function (f) {
            return f.indexOf('Spreads/') === 0 && f.endsWith('.xml');
        });

        var spreadsToRemove = [];
        for (var i = 0; i < spreadFiles.length; i++) {
            var xml = await zip.file(spreadFiles[i]).async('string');
            if (/Name="PAGE_CUSTOM"/.test(xml)) {
                spreadsToRemove.push(spreadFiles[i]);
            }
        }

        if (spreadsToRemove.length === 0) return;

        // Remove spread files from ZIP
        for (var i = 0; i < spreadsToRemove.length; i++) {
            zip.remove(spreadsToRemove[i]);
        }

        // Update designmap.xml to remove references to deleted spreads
        var designmapFile = allFiles.filter(function (f) {
            return f === 'designmap.xml';
        })[0];
        if (designmapFile) {
            var designmap = await zip.file(designmapFile).async('string');
            for (var i = 0; i < spreadsToRemove.length; i++) {
                var escaped = spreadsToRemove[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                designmap = designmap.replace(
                    new RegExp('\\s*<idPkg:Spread\\s+src="' + escaped + '"\\s*/?>', 'g'),
                    ''
                );
            }
            zip.file(designmapFile, designmap);
        }
    }

    /**
     * Remove the secondary typography page if no secondary font is specified.
     * Place an element named PAGE_TYPO_SECONDARY on the page in InDesign.
     * When fontSecondary is empty, this page is removed from the IDML.
     */
    async function processTypoSecondaryPage(zip, config) {
        // Keep the page if secondary font is specified
        if (config.fontSecondary) return;

        var allFiles = Object.keys(zip.files);
        var spreadFiles = allFiles.filter(function (f) {
            return f.indexOf('Spreads/') === 0 && f.endsWith('.xml');
        });

        var spreadsToRemove = [];
        for (var i = 0; i < spreadFiles.length; i++) {
            var xml = await zip.file(spreadFiles[i]).async('string');
            if (/Name="PAGE_TYPO_SECONDARY"/.test(xml)) {
                spreadsToRemove.push(spreadFiles[i]);
            }
        }

        if (spreadsToRemove.length === 0) return;

        // Remove spread files from ZIP
        for (var i = 0; i < spreadsToRemove.length; i++) {
            zip.remove(spreadsToRemove[i]);
        }

        // Update designmap.xml to remove references to deleted spreads
        var designmapFile = allFiles.filter(function (f) {
            return f === 'designmap.xml';
        })[0];
        if (designmapFile) {
            var designmap = await zip.file(designmapFile).async('string');
            for (var i = 0; i < spreadsToRemove.length; i++) {
                var escaped = spreadsToRemove[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                designmap = designmap.replace(
                    new RegExp('\\s*<idPkg:Spread\\s+src="' + escaped + '"\\s*/?>', 'g'),
                    ''
                );
            }
            zip.file(designmapFile, designmap);
        }
    }

    // ─── Protection zones ────────────────────────────────────────────

    /**
     * Process protection zone pages in a Spread XML.
     * Supports multiple ZONE_{TYPE}_{COLOR} frames on the same page.
     *
     * Margin calculation:
     * 1. Find reference logo (icon > text) to calculate margin in pixels
     * 2. Apply SAME pixel margin to all zones (consistent visual protection)
     * 3. Display margin as percentage of horizontal logo width
     *
     * Returns the modified XML, or null if ALL logos are missing (remove page).
     */
    function processProtectionZones(xml, scan, outputFolder, config) {
        var colorMap = {
            'original': 'original',
            'blackwhite': 'blackwhite',
            'monochrome': 'monochrome',
            'monochromelight': 'monochromeLight',
            'custom': 'custom'
        };
        var knownTypes = ['horizontal', 'vertical', 'icon', 'text', 'custom1', 'custom2', 'custom3'];

        // Find all ZONE_{TYPE}_{COLOR} frames (skip helpers like ZONE_BORDER_*)
        var nameRegex = /Name="(ZONE_\{?([A-Za-z0-9]+)\}?_\{?([A-Za-z]+)\}?)"/g;
        var zoneInfos = [];
        var m;
        while ((m = nameRegex.exec(xml)) !== null) {
            if (knownTypes.indexOf(m[2].toLowerCase()) >= 0) {
                zoneInfos.push({
                    fullName: m[1],
                    type: m[2].toLowerCase(),
                    typeUpper: m[2].toUpperCase(),
                    colorMapped: colorMap[m[3].toLowerCase()] || m[3].toLowerCase()
                });
            }
        }

        if (zoneInfos.length === 0) return xml;

        var isMultiZone = zoneInfos.length > 1;

        // ─── PASS 1: Collect zone data and find reference logo ───────────────
        var zoneData = [];
        var refLogoSize = null;  // Reference logo (icon > text) for margin calculation
        var horizontalLogoWidth = null;  // For percentage display

        for (var z = 0; z < zoneInfos.length; z++) {
            var info = zoneInfos[z];
            var sel = info.type;
            var col = info.colorMapped;

            if (!scan.logos[sel] || !scan.logos[sel][col]) {
                // Logo missing — mark for removal
                zoneData.push({ info: info, valid: false });
                continue;
            }

            var relPath = scan.logos[sel][col];
            var absPath = nodePath.join(outputFolder, relPath);

            // Find the Rectangle
            var rectRegex = new RegExp(
                '(<Rectangle[^>]*?Name="' + info.fullName.replace(/[{}]/g, '\\$&') + '"[\\s\\S]*?<\\/Rectangle>)'
            );
            var rectMatch = rectRegex.exec(xml);
            if (!rectMatch) {
                zoneData.push({ info: info, valid: false });
                continue;
            }

            var rectXml = rectMatch[1];
            var bounds = computeLogoRenderedBounds(rectXml, absPath);
            if (!bounds) {
                zoneData.push({ info: info, valid: false });
                continue;
            }

            zoneData.push({
                info: info,
                valid: true,
                relPath: relPath,
                absPath: absPath,
                rectXml: rectXml,
                bounds: bounds
            });

            // Determine reference logo size (icon > text)
            var logoMaxDim = Math.max(bounds.scaledW, bounds.scaledH);
            if (sel === 'icon' || (sel === 'text' && !refLogoSize)) {
                refLogoSize = logoMaxDim;
            }

            // Track horizontal logo width for percentage display
            if (sel === 'horizontal') {
                horizontalLogoWidth = bounds.scaledW;
            }
        }

        // If no reference logo found, use first valid zone
        if (!refLogoSize) {
            for (var i = 0; i < zoneData.length; i++) {
                if (zoneData[i].valid) {
                    refLogoSize = Math.max(zoneData[i].bounds.scaledW, zoneData[i].bounds.scaledH);
                    break;
                }
            }
        }

        // If no horizontal logo, use reference for percentage display
        if (!horizontalLogoWidth) {
            horizontalLogoWidth = refLogoSize;
        }

        // Calculate margin in pixels from reference logo
        var marginPct = config.protectionZoneMargin || 15;
        var marginPx = refLogoSize ? refLogoSize * (marginPct / 100) : 0;

        // Calculate display percentage (relative to horizontal logo width)
        var displayPct = horizontalLogoWidth ? (marginPx / horizontalLogoWidth * 100) : marginPct;

        // ─── PASS 2: Process each zone with unified margin ───────────────────
        var validCount = 0;

        for (var z = 0; z < zoneData.length; z++) {
            var data = zoneData[z];
            var info = data.info;

            if (!data.valid) {
                // Logo missing — remove this zone's frame and its helpers
                xml = removeNamedBlock(xml, info.fullName);
                xml = removeNamedBlock(xml, 'ZONE_BORDER_' + info.typeUpper);
                xml = removeNamedBlock(xml, 'ZONE_EXCLUSION_' + info.typeUpper);
                xml = removeNamedBlock(xml, 'ZONE_FILL_' + info.typeUpper);
                xml = removeNamedBlock(xml, 'ZONE_MARGIN_TEXT_' + info.typeUpper);
                if (!isMultiZone) {
                    xml = removeNamedBlock(xml, 'ZONE_BORDER');
                    xml = removeNamedBlock(xml, 'ZONE_EXCLUSION');
                    xml = removeNamedBlock(xml, 'ZONE_FILL');
                    xml = removeNamedBlock(xml, 'ZONE_MARGIN_TEXT');
                }
                continue;
            }

            validCount++;
            var relPath = data.relPath;
            var absPath = data.absPath;
            var rectXml = data.rectXml;
            var bounds = data.bounds;

            // Place logo in the zone frame
            var uriPath = 'file:///' + absPath.replace(/\\/g, '/').replace(/^\//, '');

            if (rectXml.indexOf('LinkResourceURI=') >= 0) {
                var newRectXml = rectXml.replace(
                    /LinkResourceURI="[^"]*"/,
                    'LinkResourceURI="' + escXml(uriPath) + '"'
                );
                xml = xml.replace(rectXml, newRectXml);
            } else {
                var ext = relPath.split('.').pop().toLowerCase();
                var imageType = '$ID/';
                if (ext === 'svg') imageType = '$ID/SVG';
                else if (ext === 'ai') imageType = '$ID/Adobe Illustrator';
                else if (ext === 'pdf') imageType = '$ID/Portable Document Format (PDF)';
                else if (ext === 'png') imageType = '$ID/Portable Network Graphics (PNG)';
                else if (ext === 'jpg' || ext === 'jpeg') imageType = '$ID/JPEG';

                var frameBounds = getFrameBounds(rectXml);
                var imgDims = getImageDimensions(absPath);
                var imgTransform = '1 0 0 1 0 0';
                var graphicBoundsXml = '';

                if (frameBounds && imgDims && imgDims.width > 0 && imgDims.height > 0) {
                    var scaleX = frameBounds.width / imgDims.width;
                    var scaleY = frameBounds.height / imgDims.height;
                    var scale = Math.min(scaleX, scaleY);
                    var scaledW = imgDims.width * scale;
                    var scaledH = imgDims.height * scale;
                    var tx = frameBounds.left + (frameBounds.width - scaledW) / 2;
                    var ty = frameBounds.top + (frameBounds.height - scaledH) / 2;

                    imgTransform = scale.toFixed(6) + ' 0 0 ' + scale.toFixed(6) + ' ' +
                        tx.toFixed(2) + ' ' + ty.toFixed(2);
                    graphicBoundsXml =
                        '<Properties><GraphicBounds Left="0" Top="0" ' +
                        'Right="' + imgDims.width.toFixed(2) + '" ' +
                        'Bottom="' + imgDims.height.toFixed(2) + '" /></Properties>';
                }

                var fittingXml =
                    '<FrameFittingOption AutoFit="true" ' +
                    'LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" ' +
                    'FittingOnEmptyFrame="Proportional" ' +
                    'FittingAlignment="CenterAnchor" />';

                var zoneImgId = 'uZoneImg_' + info.type + '_' + data.info.colorMapped;
                var zoneLnkId = 'uZoneLnk_' + info.type + '_' + data.info.colorMapped;

                var imageXml =
                    '<Image Self="' + zoneImgId + '" ' +
                    'ItemTransform="' + imgTransform + '" ' +
                    'ImageTypeName="' + imageType + '" ' +
                    'ImageRenderingIntent="UseColorSettings" ' +
                    'LocalDisplaySetting="Default">' +
                    graphicBoundsXml +
                    '<Link Self="' + zoneLnkId + '" AssetURL="$ID/" AssetID="$ID/" ' +
                    'LinkResourceURI="' + escXml(uriPath) + '" ' +
                    'LinkClassID="35906" StoredState="Normal" LinkObjectModified="false" />' +
                    '</Image>';

                var newRectXml = rectXml.replace(/<\/Rectangle>/, fittingXml + imageXml + '</Rectangle>');
                xml = xml.replace(rectXml, newRectXml);
            }

            // Calculate bounds with UNIFIED margin (same px for all zones)
            var logoBounds = bounds.spread;
            var exclusionBounds = {
                left: logoBounds.left - marginPx,
                top: logoBounds.top - marginPx,
                right: logoBounds.right + marginPx,
                bottom: logoBounds.bottom + marginPx
            };

            // Debug: log computed values to file
            var debugMsg = '[ZONE] ' + info.typeUpper + ':\n' +
                '  Logo file: ' + relPath + '\n' +
                '  Logo rendered: ' + bounds.scaledW.toFixed(1) + 'x' + bounds.scaledH.toFixed(1) + ' pt\n' +
                '  Reference logo size: ' + (refLogoSize ? refLogoSize.toFixed(1) : 'N/A') + ' pt\n' +
                '  Unified margin: ' + marginPx.toFixed(1) + ' pt\n' +
                '  Display percentage: ' + displayPct.toFixed(1) + '%\n';
            console.log(debugMsg);

            try {
                var tempDbgDir = nodePath.join(config.outputFolder, '_temp');
                if (!fs.existsSync(tempDbgDir)) fs.mkdirSync(tempDbgDir);
                var debugPath = nodePath.join(tempDbgDir, 'zone-debug.txt');
                fs.appendFileSync(debugPath, debugMsg + '\n');
            } catch (e) { /* ignore */ }

            // Reposition type-specific helpers
            xml = repositionNamedRect(xml, 'ZONE_BORDER_' + info.typeUpper, logoBounds);
            xml = repositionNamedRect(xml, 'ZONE_EXCLUSION_' + info.typeUpper, exclusionBounds);
            xml = repositionNamedRect(xml, 'ZONE_FILL_' + info.typeUpper, exclusionBounds);

            // Reposition margin text label
            var marginTextCenter = {
                x: (exclusionBounds.left + exclusionBounds.right) / 2,
                y: exclusionBounds.top + (marginPx * 0.5)
            };
            xml = repositionTextFrame(xml, 'ZONE_MARGIN_TEXT_' + info.typeUpper, marginTextCenter);

            // For single-zone pages, also handle generic names
            if (!isMultiZone) {
                xml = repositionNamedRect(xml, 'ZONE_BORDER', logoBounds);
                xml = repositionNamedRect(xml, 'ZONE_EXCLUSION', exclusionBounds);
                xml = repositionNamedRect(xml, 'ZONE_FILL', exclusionBounds);
                xml = repositionTextFrame(xml, 'ZONE_MARGIN_TEXT', marginTextCenter);
            }
        }

        // Store margin values for Story processing
        config.zoneMarginValues = config.zoneMarginValues || {};

        // DISPLAY = percentage relative to horizontal width (main display value)
        config.zoneMarginValues['DISPLAY'] = displayPct.toFixed(0) + '%';

        // HORIZONTAL = percentage relative to horizontal width
        config.zoneMarginValues['HORIZONTAL'] = displayPct.toFixed(0) + '%';

        // ICON = user's original selected percentage (since icon is the reference)
        config.zoneMarginValues['ICON'] = marginPct + '%';

        // TEXT = user's original percentage (fallback reference)
        config.zoneMarginValues['TEXT'] = marginPct + '%';

        if (validCount === 0) return null; // all logos missing — remove page
        return xml;
    }

    // ─── Prohibitions (logo misuse examples) ──────────────────────────

    /**
     * Build drop shadow XML for an Image element.
     * The shadow follows the image's actual shape (alpha channel).
     *
     * @returns {string} TransparencySetting XML string
     */
    function buildDropShadowXml() {
        return '<TransparencySetting>' +
                '<DropShadowSetting Mode="Drop" ' +
                'XOffset="5" YOffset="5" ' +
                'Blur="8" ' +
                'SpreadAmount="0" ' +
                'Noise="0" ' +
                'EffectColor="Swatch/Black" ' +
                'Opacity="75" ' +
                'BlendMode="Multiply" />' +
            '</TransparencySetting>';
    }

    /**
     * Build wrong color tint XML for an Image element.
     * Uses InnerShadow with high spread to create a color overlay effect.
     * This fills the logo shape with a wrong color (magenta).
     *
     * @returns {string} TransparencySetting XML string
     */
    function buildWrongColorXml() {
        // Use InnerShadowSetting with high spread to fill the entire shape
        // with a visible "wrong" color (magenta)
        return '<TransparencySetting>' +
                '<InnerShadowSetting Applied="true" ' +
                'Mode="InnerShadow" ' +
                'BlendMode="Color" ' +
                'Opacity="80" ' +
                'Noise="0" ' +
                'ChokeAmount="100" ' +
                'Size="500" ' +
                'XOffset="0" ' +
                'YOffset="0" ' +
                'UseGlobalLight="false" ' +
                'Angle="0" ' +
                'Distance="0" ' +
                'EffectColor="Color/RVB Magenta" />' +
            '</TransparencySetting>';
    }

    /**
     * Process prohibition frames in a Spread XML.
     * Places logos with specific transformations (stretch, rotate, shadow, etc.)
     *
     * Frame naming: PROHIB_{TYPE}_{COLOR}
     * TYPE: STRETCH, SHADOW, ROTATE, ZONE, VARIATION, COLOR, FONT, ELEMENT
     * COLOR: ORIGINAL, BLACKWHITE, MONOCHROME, MONOCHROMELIGHT, CUSTOM
     *
     * @param {string} xml - Spread XML
     * @param {object} scan - Logo scan results
     * @param {string} outputFolder - Output folder path
     * @param {object} config - Configuration
     * @returns {string} Modified XML
     */
    function processProhibitions(xml, scan, outputFolder, config) {
        var colorMap = {
            'original': 'original',
            'blackwhite': 'blackwhite',
            'monochrome': 'monochrome',
            'monochromelight': 'monochromeLight',
            'custom': 'custom'
        };

        var imgCounter = 0;

        // Use EXACT same pattern as processSpreadXml: regex.replace with callback
        var regex = /<Rectangle[^>]*?Name="PROHIB_([A-Z]+)_([A-Za-z]+)"[\s\S]*?<\/Rectangle>\s*/g;

        xml = xml.replace(regex, function (match, prohibType, color) {
            var colorMapped = colorMap[color.toLowerCase()] || color.toLowerCase();

            // Try logo types in priority order: vertical > horizontal > text > icon
            var logoSel = null;
            var logoFallbacks = ['vertical', 'horizontal', 'text', 'icon'];
            for (var f = 0; f < logoFallbacks.length; f++) {
                var tryType = logoFallbacks[f];
                if (scan.logos[tryType] && scan.logos[tryType][colorMapped]) {
                    logoSel = tryType;
                    break;
                }
            }

            // No logo found - remove frame
            if (!logoSel) {
                return '';
            }

            // Skip if already has an image
            if (match.indexOf('<Image') >= 0 || match.indexOf('LinkResourceURI=') >= 0) {
                return match;
            }

            var relPath = scan.logos[logoSel][colorMapped];
            var absPath = nodePath.join(outputFolder, relPath).replace(/\\/g, '/');
            var uriPath = 'file:///' + absPath.replace(/^\//, '');

            imgCounter++;
            var ext = relPath.split('.').pop().toLowerCase();
            var imageType = '$ID/';
            if (ext === 'svg') imageType = '$ID/SVG';
            else if (ext === 'ai') imageType = '$ID/Adobe Illustrator';
            else if (ext === 'pdf') imageType = '$ID/Portable Document Format (PDF)';
            else if (ext === 'png') imageType = '$ID/Portable Network Graphics (PNG)';
            else if (ext === 'jpg' || ext === 'jpeg') imageType = '$ID/JPEG';

            // Get frame bounds and image dimensions — identique à processSpreadXml
            var frameBounds = getFrameBounds(match);
            var imgDims = getImageDimensions(absPath);
            var imgTransform = '1 0 0 1 0 0';
            var graphicBoundsXml = '';
            var effectXml = '';

            if (frameBounds && imgDims && imgDims.width > 0 && imgDims.height > 0) {
                var scaleX = frameBounds.width / imgDims.width;
                var scaleY = frameBounds.height / imgDims.height;
                var scale, finalScaleX, finalScaleY;

                if (prohibType === 'STRETCH') {
                    scale = Math.min(scaleX / 1.4, scaleY / 0.7) * 0.75;
                    finalScaleX = scale * 1.4;
                    finalScaleY = scale * 0.7;
                } else {
                    // SHADOW, COLOR: 100% contain identique à processSpreadXml
                    // Le resize 75% est fait en post-traitement via BridgeTalk
                    scale = Math.min(scaleX, scaleY);
                    finalScaleX = scale;
                    finalScaleY = scale;
                }

                var scaledW = imgDims.width * finalScaleX;
                var scaledH = imgDims.height * finalScaleY;

                var tx = frameBounds.left + (frameBounds.width - scaledW) / 2;
                var ty = frameBounds.top + (frameBounds.height - scaledH) / 2;

                imgTransform = finalScaleX.toFixed(6) + ' 0 0 ' + finalScaleY.toFixed(6) + ' ' +
                    tx.toFixed(2) + ' ' + ty.toFixed(2);

                graphicBoundsXml =
                    '<Properties><GraphicBounds Left="0" Top="0" ' +
                    'Right="' + imgDims.width.toFixed(2) + '" ' +
                    'Bottom="' + imgDims.height.toFixed(2) + '" /></Properties>';
            }

            // Build effect XML
            if (prohibType === 'SHADOW') {
                effectXml = buildDropShadowXml();
            } else if (prohibType === 'COLOR') {
                effectXml = buildWrongColorXml();
            }

            // Image XML with effect
            var imageXml =
                '<Image Self="uProhibImg' + imgCounter + '" ' +
                'ItemTransform="' + imgTransform + '" ' +
                'ImageTypeName="' + imageType + '" ' +
                'ImageRenderingIntent="UseColorSettings" ' +
                'LocalDisplaySetting="Default">' +
                effectXml +
                graphicBoundsXml +
                '<Link Self="uProhibLnk' + imgCounter + '" AssetURL="$ID/" AssetID="$ID/" ' +
                'LinkResourceURI="' + escXml(uriPath) + '" ' +
                'LinkClassID="35906" StoredState="Normal" LinkObjectModified="false" />' +
                '</Image>';

            // FrameFittingOption identique à processSpreadXml
            var fittingXml =
                '<FrameFittingOption AutoFit="true" ' +
                'LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" ' +
                'FittingOnEmptyFrame="Proportional" ' +
                'FittingAlignment="CenterAnchor" />';

            return match.replace(/<\/Rectangle>/, fittingXml + imageXml + '</Rectangle>');
        });

        return xml;
    }

    /**
     * Process MOCKUP_{NAME} frames in Spread XML.
     * Sets LinkResourceURI pointing to the future PNG export path
     * (the PNG will be created later by Photoshop via BridgeTalk).
     *
     * @param {string} xml - Spread XML content
     * @param {object} mockupScan - Result of scanAvailableMockups()
     * @param {string} outputFolder - Output folder path
     * @returns {string} Modified XML
     */
    function processMockupFrames(xml, mockupScan, outputFolder) {
        if (!mockupScan || !mockupScan.mockups || mockupScan.count === 0) {
            return xml;
        }

        var imgCounter = 0;

        // Build lookup map: frameName → mockup info
        var mockupMap = {};
        for (var i = 0; i < mockupScan.mockups.length; i++) {
            var m = mockupScan.mockups[i];
            mockupMap[m.name] = m;
        }

        // Match MOCKUP_{NAME} rectangles (full block including closing tag)
        var regex = /(<Rectangle[^>]*?Name="(MOCKUP_[A-Z0-9_-]+)"[\s\S]*?<\/Rectangle>)\s*/g;

        xml = xml.replace(regex, function (match, fullRect, frameName) {
            var mockup = mockupMap[frameName];

            // No matching PSD found → remove the frame
            if (!mockup) {
                console.log('[MOCKUP] No PSD for frame: ' + frameName + ', removing');
                return '';
            }

            // Skip if already has an image
            if (match.indexOf('<Image') >= 0 || match.indexOf('LinkResourceURI=') >= 0) {
                return match;
            }

            imgCounter++;

            // Predicted output path (Photoshop will create this PNG later)
            var mockupOutputName = mockup.filename.replace(/\.psd$/i, '.png').toLowerCase();
            var mockupAbsPath = nodePath.join(outputFolder, 'mockups', mockupOutputName).replace(/\\/g, '/');
            var uriPath = 'file:///' + mockupAbsPath.replace(/^\//, '');

            // Get frame bounds for transform
            var frameBounds = getFrameBounds(match);
            var imgTransform = '1 0 0 1 0 0';
            if (frameBounds) {
                imgTransform = '1 0 0 1 ' + frameBounds.left.toFixed(2) + ' ' + frameBounds.top.toFixed(2);
            }

            // Build Image element (PNG type)
            var imageXml =
                '<Image Self="uMockupImg' + imgCounter + '" ' +
                'ItemTransform="' + imgTransform + '" ' +
                'ImageTypeName="$ID/Portable Network Graphics (PNG)" ' +
                'ImageRenderingIntent="UseColorSettings" ' +
                'LocalDisplaySetting="Default">' +
                '<Link Self="uMockupLnk' + imgCounter + '" AssetURL="$ID/" AssetID="$ID/" ' +
                'LinkResourceURI="' + escXml(uriPath) + '" ' +
                'LinkClassID="35906" StoredState="Normal" LinkObjectModified="false" />' +
                '</Image>';

            // FrameFittingOption: AutoFit + Proportional (same as other frame types)
            var fittingXml =
                '<FrameFittingOption AutoFit="true" ' +
                'LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" ' +
                'FittingOnEmptyFrame="Proportional" ' +
                'FittingAlignment="CenterAnchor" />';

            console.log('[MOCKUP] Placed: ' + frameName + ' → ' + mockupOutputName);

            return match.replace(/<\/Rectangle>/, fittingXml + imageXml + '</Rectangle>');
        });

        return xml;
    }

    // ─── XML processors ────────────────────────────────────────────

    /**
     * Process a Spread XML: link images for available logos,
     * remove Rectangle elements for unavailable logos.
     *
     * Handles frame names with or without curly braces:
     *   LOGO_HORIZONTAL_ORIGINAL  or  LOGO_{HORIZONTAL}_{ORIGINAL}
     *
     * If the frame already contains a Link element, its URI is replaced.
     * If the frame is empty (no image placed), an Image+Link element is inserted.
     */
    function processSpreadXml(xml, scan, outputFolder) {
        // Match Rectangle elements with Name="LOGO_{TYPE}_{COLOR}" or "LOGO_TYPE_COLOR"
        var regex = /<Rectangle[^>]*?Name="LOGO_\{?([A-Za-z0-9]+)\}?_\{?([A-Za-z]+)\}?"[\s\S]*?<\/Rectangle>\s*/g;

        // Map template color names (uppercase) → output folder names (camelCase)
        var colorMap = {
            'original': 'original',
            'blackwhite': 'blackwhite',
            'monochrome': 'monochrome',
            'monochromelight': 'monochromeLight',
            'custom': 'custom'
        };

        var imgCounter = 0;

        xml = xml.replace(regex, function (match, selection, color) {
            var sel = selection.toLowerCase();
            var col = colorMap[color.toLowerCase()] || color.toLowerCase();

            if (scan.logos[sel] && scan.logos[sel][col]) {
                var relPath = scan.logos[sel][col];
                var absPath = nodePath.join(outputFolder, relPath).replace(/\\/g, '/');
                var uriPath = 'file:///' + absPath.replace(/^\//, '');

                if (match.indexOf('LinkResourceURI=') >= 0) {
                    // Frame already has an image linked — replace URI
                    return match.replace(
                        /LinkResourceURI="[^"]*"/,
                        'LinkResourceURI="' + escXml(uriPath) + '"'
                    );
                } else {
                    // Empty graphic frame — insert FrameFittingOption + Image+Link
                    imgCounter++;
                    var ext = relPath.split('.').pop().toLowerCase();
                    var imageType = '$ID/';
                    if (ext === 'svg') imageType = '$ID/SVG';
                    else if (ext === 'ai') imageType = '$ID/Adobe Illustrator';
                    else if (ext === 'pdf') imageType = '$ID/Portable Document Format (PDF)';
                    else if (ext === 'png') imageType = '$ID/Portable Network Graphics (PNG)';
                    else if (ext === 'jpg' || ext === 'jpeg') imageType = '$ID/JPEG';

                    // Compute image transform to fit proportionally in frame
                    var frameBounds = getFrameBounds(match);
                    var imgDims = getImageDimensions(absPath);
                    var imgTransform = '1 0 0 1 0 0'; // fallback identity
                    var graphicBoundsXml = '';

                    if (frameBounds && imgDims && imgDims.width > 0 && imgDims.height > 0) {
                        var scaleX = frameBounds.width / imgDims.width;
                        var scaleY = frameBounds.height / imgDims.height;
                        var scale = Math.min(scaleX, scaleY); // fit proportionally

                        var scaledW = imgDims.width * scale;
                        var scaledH = imgDims.height * scale;

                        // Center within frame
                        var tx = frameBounds.left + (frameBounds.width - scaledW) / 2;
                        var ty = frameBounds.top + (frameBounds.height - scaledH) / 2;

                        imgTransform = scale.toFixed(6) + ' 0 0 ' + scale.toFixed(6) + ' ' +
                            tx.toFixed(2) + ' ' + ty.toFixed(2);

                        graphicBoundsXml =
                            '<Properties><GraphicBounds Left="0" Top="0" ' +
                            'Right="' + imgDims.width.toFixed(2) + '" ' +
                            'Bottom="' + imgDims.height.toFixed(2) + '" /></Properties>';
                    }

                    // FrameFittingOption: fit proportionally + center
                    var fittingXml =
                        '<FrameFittingOption AutoFit="true" ' +
                        'LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" ' +
                        'FittingOnEmptyFrame="Proportional" ' +
                        'FittingAlignment="CenterAnchor" />';

                    var imageXml =
                        '<Image Self="uAutoImg' + imgCounter + '" ' +
                        'ItemTransform="' + imgTransform + '" ' +
                        'ImageTypeName="' + imageType + '" ' +
                        'ImageRenderingIntent="UseColorSettings" ' +
                        'LocalDisplaySetting="Default">' +
                        graphicBoundsXml +
                        '<Link Self="uAutoLnk' + imgCounter + '" AssetURL="$ID/" AssetID="$ID/" ' +
                        'LinkResourceURI="' + escXml(uriPath) + '" ' +
                        'LinkClassID="35906" StoredState="Normal" LinkObjectModified="false" />' +
                        '</Image>';

                    return match.replace(/<\/Rectangle>/, fittingXml + imageXml + '</Rectangle>');
                }
            } else {
                // Logo not available — keep the frame as-is (empty placeholder)
                return match;
            }
        });

        return xml;
    }

    /**
     * Process a Story XML: replace text placeholders.
     * {{BRAND_NAME}}       → brand name
     * {{FONT_PRIMARY}}     → primary font family name
     * {{FONT_SECONDARY}}   → secondary font family name
     * {{COLOR_N_HEX}}      → #RRGGBB (original detected)
     * {{COLOR_N_RGB}}       → R:r G:g B:b
     * {{COLOR_N_CMYK}}      → C:c M:m Y:y K:k
     * {{CUSTOM_N_HEX}}     → #RRGGBB (user-chosen custom)
     * {{CUSTOM_N_RGB}}      → R:r G:g B:b
     * {{CUSTOM_N_CMYK}}     → C:c M:m Y:y K:k
     * {{MONO_DARK_HEX/RGB/CMYK}}  → monochrome dark values
     * {{MONO_LIGHT_HEX/RGB/CMYK}} → monochrome light values
     */
    function processStoryXml(xml, config) {
        // Brand name
        xml = xml.replace(/\{\{BRAND_NAME\}\}/g, escXml(config.brandName || 'Logo'));

        // Font names
        xml = xml.replace(/\{\{FONT_PRIMARY\}\}/g, escXml(config.fontPrimary || '-'));
        xml = xml.replace(/\{\{FONT_SECONDARY\}\}/g, escXml(config.fontSecondary || '-'));

        // Color placeholders (brand colors — original + custom)
        if (config.colors && config.colors.length > 0) {
            for (var i = 0; i < config.colors.length; i++) {
                var hexOrig = config.colors[i].original || config.colors[i];
                var hexCust = config.colors[i].custom || hexOrig;
                var idx = i + 1;

                // {{COLOR_N_HEX/RGB/CMYK}} → original detected color
                if (typeof hexOrig === 'string') {
                    var rgb = hexToRgbValues(hexOrig);
                    var cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
                    xml = xml.replace(
                        new RegExp('\\{\\{COLOR_' + idx + '_HEX\\}\\}', 'g'),
                        escXml(hexOrig.toUpperCase())
                    );
                    xml = xml.replace(
                        new RegExp('\\{\\{COLOR_' + idx + '_RGB\\}\\}', 'g'),
                        'R:' + rgb.r + ' G:' + rgb.g + ' B:' + rgb.b
                    );
                    xml = xml.replace(
                        new RegExp('\\{\\{COLOR_' + idx + '_CMYK\\}\\}', 'g'),
                        'C:' + cmyk.c + ' M:' + cmyk.m + ' Y:' + cmyk.y + ' K:' + cmyk.k
                    );
                }

                // {{CUSTOM_N_HEX/RGB/CMYK}} → user-chosen custom color
                if (typeof hexCust === 'string') {
                    var rgbC = hexToRgbValues(hexCust);
                    var cmykC = rgbToCmyk(rgbC.r, rgbC.g, rgbC.b);
                    xml = xml.replace(
                        new RegExp('\\{\\{CUSTOM_' + idx + '_HEX\\}\\}', 'g'),
                        escXml(hexCust.toUpperCase())
                    );
                    xml = xml.replace(
                        new RegExp('\\{\\{CUSTOM_' + idx + '_RGB\\}\\}', 'g'),
                        'R:' + rgbC.r + ' G:' + rgbC.g + ' B:' + rgbC.b
                    );
                    xml = xml.replace(
                        new RegExp('\\{\\{CUSTOM_' + idx + '_CMYK\\}\\}', 'g'),
                        'C:' + cmykC.c + ' M:' + cmykC.m + ' Y:' + cmykC.y + ' K:' + cmykC.k
                    );
                }
            }
        }

        // Monochrome color placeholders
        if (config.monochromeColor) {
            var monoDarkRgb = hexToRgbValues(config.monochromeColor);
            var monoDarkCmyk = rgbToCmyk(monoDarkRgb.r, monoDarkRgb.g, monoDarkRgb.b);
            xml = xml.replace(/\{\{MONO_DARK_HEX\}\}/g, escXml(config.monochromeColor.toUpperCase()));
            xml = xml.replace(/\{\{MONO_DARK_RGB\}\}/g, 'R:' + monoDarkRgb.r + ' G:' + monoDarkRgb.g + ' B:' + monoDarkRgb.b);
            xml = xml.replace(/\{\{MONO_DARK_CMYK\}\}/g, 'C:' + monoDarkCmyk.c + ' M:' + monoDarkCmyk.m + ' Y:' + monoDarkCmyk.y + ' K:' + monoDarkCmyk.k);
        }
        if (config.monochromeLightColor) {
            var monoLightRgb = hexToRgbValues(config.monochromeLightColor);
            var monoLightCmyk = rgbToCmyk(monoLightRgb.r, monoLightRgb.g, monoLightRgb.b);
            xml = xml.replace(/\{\{MONO_LIGHT_HEX\}\}/g, escXml(config.monochromeLightColor.toUpperCase()));
            xml = xml.replace(/\{\{MONO_LIGHT_RGB\}\}/g, 'R:' + monoLightRgb.r + ' G:' + monoLightRgb.g + ' B:' + monoLightRgb.b);
            xml = xml.replace(/\{\{MONO_LIGHT_CMYK\}\}/g, 'C:' + monoLightCmyk.c + ' M:' + monoLightCmyk.m + ' Y:' + monoLightCmyk.y + ' K:' + monoLightCmyk.k);
        }

        // Zone margin placeholder (percentage)
        xml = xml.replace(/\{\{ZONE_MARGIN_PCT\}\}/g, String(config.protectionZoneMargin || 15));

        // Zone margin values (percentage relative to horizontal logo width)
        // Supports: {{ZONE_MARGIN_VALUE}}, {{ZONE_MARGIN_VALUE_HORIZONTAL}}, {{ZONE_MARGIN_VALUE_ICON}}, etc.
        if (config.zoneMarginValues) {
            // Replace type-specific placeholders
            for (var type in config.zoneMarginValues) {
                if (type !== 'DISPLAY') {
                    var marginRegex = new RegExp('\\{\\{ZONE_MARGIN_VALUE_' + type + '\\}\\}', 'g');
                    xml = xml.replace(marginRegex, config.zoneMarginValues[type]);
                }
            }
            // Generic {{ZONE_MARGIN_VALUE}} uses the unified display value
            var displayValue = config.zoneMarginValues['DISPLAY'] || '-';
            xml = xml.replace(/\{\{ZONE_MARGIN_VALUE\}\}/g, displayValue);
        } else {
            xml = xml.replace(/\{\{ZONE_MARGIN_VALUE\}\}/g, '-');
        }
        // Clean up any remaining type-specific placeholders
        xml = xml.replace(/\{\{ZONE_MARGIN_VALUE_[A-Z]+\}\}/g, '-');

        // Clean up remaining color placeholders (unused slots)
        xml = xml.replace(/\{\{COLOR_\d+_(?:HEX|RGB|CMYK)\}\}/g, '-');
        xml = xml.replace(/\{\{CUSTOM_\d+_(?:HEX|RGB|CMYK)\}\}/g, '-');
        xml = xml.replace(/\{\{MONO_(?:DARK|LIGHT)_(?:HEX|RGB|CMYK)\}\}/g, '-');

        // Replace character-level AppliedFont overrides inside BRAND_PRIMARY / BRAND_SECONDARY ranges
        if (config.fontPrimary) {
            xml = replaceStoryFonts(xml, 'BRAND_PRIMARY', config.fontPrimary);
        }
        // Use fontSecondary if specified, otherwise fallback to fontPrimary
        var secondaryFont = config.fontSecondary || config.fontPrimary;
        if (secondaryFont) {
            xml = replaceStoryFonts(xml, 'BRAND_SECONDARY', secondaryFont);
        }

        return xml;
    }

    /**
     * Within ParagraphStyleRange blocks that reference a given style name,
     * replace any character-level <AppliedFont> Properties override
     * so text inherits the chosen font instead of a hardcoded one.
     * Also handles AppliedFont as an attribute on CharacterStyleRange.
     */
    function replaceStoryFonts(xml, styleName, fontFamily) {
        var escaped = escXml(fontFamily);
        // Match entire ParagraphStyleRange referencing this style
        var rangeRegex = new RegExp(
            '(<ParagraphStyleRange[^>]*AppliedParagraphStyle="ParagraphStyle/' + styleName + '"' +
            '[\\s\\S]*?<\\/ParagraphStyleRange>)', 'g'
        );

        xml = xml.replace(rangeRegex, function(rangeBlock) {
            // Replace <AppliedFont type="string">...</AppliedFont> in Properties
            rangeBlock = rangeBlock.replace(
                /<AppliedFont type="string">[^<]*<\/AppliedFont>/g,
                '<AppliedFont type="string">' + escaped + '</AppliedFont>'
            );
            // Replace AppliedFont attribute on CharacterStyleRange tags
            rangeBlock = rangeBlock.replace(
                /(<CharacterStyleRange[^>]*\bAppliedFont=")[^"]*(")/g,
                '$1' + escaped + '$2'
            );
            return rangeBlock;
        });

        return xml;
    }

    // ─── Main generate function ────────────────────────────────────

    async function generate(config) {
        try {
            // Validate inputs
            if (!config.outputFolder) {
                return { success: false, error: 'Dossier de sortie non defini.' };
            }
            if (!config.templatePath) {
                return { success: false, error: 'Aucun template selectionne.' };
            }
            if (!fs.existsSync(config.templatePath)) {
                return { success: false, error: 'Template introuvable : ' + nodePath.basename(config.templatePath) };
            }

            console.log('[IDML] Config: fontPrimary="' + (config.fontPrimary || '') +
                '", fontSecondary="' + (config.fontSecondary || '') +
                '", brandName="' + (config.brandName || '') +
                '", template="' + nodePath.basename(config.templatePath) + '"');

            // 1. Scan available logos in the output folder
            var scan = scanAvailableLogos(config.outputFolder);
            var mockupScan = config.extensionPath ? scanAvailableMockups(config.extensionPath) : { mockups: [], count: 0 };
            if (mockupScan.count > 0) {
                console.log('[IDML] Found ' + mockupScan.count + ' mockup PSD(s)');
            }

            var hasLogos = false;
            for (var s in scan.logos) {
                for (var c in scan.logos[s]) {
                    hasLogos = true;
                    break;
                }
                if (hasLogos) break;
            }
            if (!hasLogos) {
                return { success: false, error: 'Aucun fichier logo trouve dans le dossier de sortie.' };
            }

            // 2. Load the template IDML (ZIP)
            var templateBuffer = fs.readFileSync(config.templatePath);
            var zip = await JSZip.loadAsync(templateBuffer);

            // 3. Remove conditional pages (before processing content)
            await processConditionalPages(zip, config);
            await processTypoSecondaryPage(zip, config);

            // 4. Process Spread files (image frames)
            var allFiles = Object.keys(zip.files);
            var spreadFiles = allFiles.filter(function (f) {
                return f.indexOf('Spreads/') === 0 && f.endsWith('.xml');
            });

            for (var i = 0; i < spreadFiles.length; i++) {
                var spreadXml = await zip.file(spreadFiles[i]).async('string');
                spreadXml = processConditionalBlocks(spreadXml, config, scan);
                spreadXml = processSpreadXml(spreadXml, scan, config.outputFolder);
                zip.file(spreadFiles[i], spreadXml);
            }

            // Also process MasterSpreads in case placeholders are there
            var masterFiles = allFiles.filter(function (f) {
                return f.indexOf('MasterSpreads/') === 0 && f.endsWith('.xml');
            });
            for (var i = 0; i < masterFiles.length; i++) {
                var masterXml = await zip.file(masterFiles[i]).async('string');
                masterXml = processConditionalBlocks(masterXml, config, scan);
                masterXml = processSpreadXml(masterXml, scan, config.outputFolder);
                zip.file(masterFiles[i], masterXml);
            }

            // 4b. Process protection zone pages
            var zoneSpreadsToRemove = [];
            for (var i = 0; i < spreadFiles.length; i++) {
                var zoneXml = await zip.file(spreadFiles[i]).async('string');
                if (/Name="ZONE_/.test(zoneXml)) {
                    var zoneResult = processProtectionZones(zoneXml, scan, config.outputFolder, config);
                    if (zoneResult === null) {
                        zoneSpreadsToRemove.push(spreadFiles[i]);
                    } else {
                        zip.file(spreadFiles[i], zoneResult);
                    }
                }
            }
            if (zoneSpreadsToRemove.length > 0) {
                for (var i = 0; i < zoneSpreadsToRemove.length; i++) {
                    zip.remove(zoneSpreadsToRemove[i]);
                }
                var dmFile = allFiles.filter(function (f) { return f === 'designmap.xml'; })[0];
                if (dmFile) {
                    var dm = await zip.file(dmFile).async('string');
                    for (var i = 0; i < zoneSpreadsToRemove.length; i++) {
                        var esc = zoneSpreadsToRemove[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        dm = dm.replace(
                            new RegExp('\\s*<idPkg:Spread\\s+src="' + esc + '"\\s*/?>', 'g'), ''
                        );
                    }
                    zip.file(dmFile, dm);
                }
            }

            // 4c. Process prohibition pages (logo misuse examples)
            for (var i = 0; i < spreadFiles.length; i++) {
                if (zoneSpreadsToRemove.indexOf(spreadFiles[i]) >= 0) continue;
                var prohibXml = await zip.file(spreadFiles[i]).async('string');
                if (/Name="PROHIB_/.test(prohibXml)) {
                    prohibXml = processProhibitions(prohibXml, scan, config.outputFolder, config);
                    zip.file(spreadFiles[i], prohibXml);
                }
            }

            // 4d. Process mockup frames (Photoshop integration)
            for (var i = 0; i < spreadFiles.length; i++) {
                if (zoneSpreadsToRemove.indexOf(spreadFiles[i]) >= 0) continue;
                var mockupXml = await zip.file(spreadFiles[i]).async('string');
                if (/Name="MOCKUP_/.test(mockupXml)) {
                    mockupXml = processMockupFrames(mockupXml, mockupScan, config.outputFolder);
                    zip.file(spreadFiles[i], mockupXml);
                }
            }

            // 5. Process Story files (text placeholders)
            var storyFiles = allFiles.filter(function (f) {
                return f.indexOf('Stories/') === 0 && f.endsWith('.xml');
            });

            for (var i = 0; i < storyFiles.length; i++) {
                var storyXml = await zip.file(storyFiles[i]).async('string');
                storyXml = processStoryXml(storyXml, config);
                zip.file(storyFiles[i], storyXml);
            }

            // 6. Process Graphic.xml (color swatches)
            var graphicFile = allFiles.filter(function (f) {
                return f === 'Resources/Graphic.xml';
            })[0];
            if (graphicFile) {
                var graphicXml = await zip.file(graphicFile).async('string');
                graphicXml = processGraphicXml(graphicXml, config);
                zip.file(graphicFile, graphicXml);
            }

            // 7. Process Styles.xml (typography — primary + secondary fonts)
            var stylesFile = allFiles.filter(function (f) {
                return f === 'Resources/Styles.xml';
            })[0];
            if (stylesFile && (config.fontPrimary || config.fontSecondary)) {
                var stylesXml = await zip.file(stylesFile).async('string');
                stylesXml = processStylesXml(stylesXml, config.fontPrimary, config.fontSecondary);
                zip.file(stylesFile, stylesXml);
            }

            // 8. Generate the output IDML
            var buffer = await zip.generateAsync({
                type: 'nodebuffer',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            var outputPath = nodePath.join(config.outputFolder, 'presentation-logo.idml');
            fs.writeFileSync(outputPath, buffer);

            return {
                success: true,
                filename: 'presentation-logo.idml',
                path: outputPath,
                mockupData: {
                    mockups: mockupScan.mockups,
                    count: mockupScan.count
                }
            };

        } catch (err) {
            return {
                success: false,
                error: err.message || String(err)
            };
        }
    }

    // Public API
    return {
        generate: generate
    };

})();
