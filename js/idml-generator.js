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

        xml = xml.replace(regex, function(rectXml) {
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

        return xml;
    }

    // ─── File scanner ──────────────────────────────────────────────

    /**
     * Find the best available logo file in the output folder.
     * Priority: SVG > AI > PNG > JPG.
     *
     * First tries exact expected filenames, then falls back to scanning
     * the directory for any file matching the priority order
     * (exportForScreens can create subfolders or different naming).
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

        // 1. Try exact filenames first (fastest) — SVG > AI > PNG
        var exactCandidates = [
            nodePath.join(selDir, fileName + '.svg'),
            nodePath.join(selDir, fileName + '.ai'),
            nodePath.join(selDir, fileName + '.pdf'),
            nodePath.join(selDir, 'PNG', 'moyen_' + fileName + '.png'),
            nodePath.join(selDir, 'PNG', 'grand_' + fileName + '.png'),
            nodePath.join(selDir, 'PNG', 'petit_' + fileName + '.png')
        ];

        for (var i = 0; i < exactCandidates.length; i++) {
            try {
                if (fs.existsSync(exactCandidates[i])) {
                    return nodePath.relative(outputFolder, exactCandidates[i]);
                }
            } catch (e) { /* skip */ }
        }

        // 2. Fallback: scan directory for vector files (SVG > AI > PDF)
        var vectorExts = ['.svg', '.ai', '.pdf'];
        try {
            var files = fs.readdirSync(selDir);

            // Check root of color folder
            for (var e = 0; e < vectorExts.length; e++) {
                for (var f = 0; f < files.length; f++) {
                    if (files[f].toLowerCase().endsWith(vectorExts[e])) {
                        return nodePath.relative(outputFolder, nodePath.join(selDir, files[f]));
                    }
                }
            }

            // Check subfolders (exportForScreens may create them)
            for (var f = 0; f < files.length; f++) {
                var subPath = nodePath.join(selDir, files[f]);
                try {
                    if (!fs.statSync(subPath).isDirectory()) continue;
                    var folderUpper = files[f].toUpperCase();
                    if (folderUpper === 'PNG' || folderUpper === 'JPG' || folderUpper === 'JPEG') continue;
                    var subFiles = fs.readdirSync(subPath);
                    for (var e = 0; e < vectorExts.length; e++) {
                        for (var sf = 0; sf < subFiles.length; sf++) {
                            if (subFiles[sf].toLowerCase().endsWith(vectorExts[e])) {
                                return nodePath.relative(outputFolder, nodePath.join(subPath, subFiles[sf]));
                            }
                        }
                    }
                } catch (e2) { /* skip */ }
            }

            // 3. Fallback: PNG
            var rasterExts = ['.png', '.jpg', '.jpeg'];
            var rasterDirs = ['PNG', 'JPG', 'JPEG'];
            for (var rd = 0; rd < rasterDirs.length; rd++) {
                var rasterDir = nodePath.join(selDir, rasterDirs[rd]);
                try {
                    if (!fs.existsSync(rasterDir)) continue;
                    var rasterFiles = fs.readdirSync(rasterDir);
                    for (var re = 0; re < rasterExts.length; re++) {
                        for (var rf = 0; rf < rasterFiles.length; rf++) {
                            if (rasterFiles[rf].toLowerCase().endsWith(rasterExts[re])) {
                                return nodePath.relative(outputFolder, nodePath.join(rasterDir, rasterFiles[rf]));
                            }
                        }
                    }
                } catch (e3) { /* skip */ }
            }

            // 4. Last resort: any raster in root folder
            for (var re = 0; re < rasterExts.length; re++) {
                for (var f = 0; f < files.length; f++) {
                    if (files[f].toLowerCase().endsWith(rasterExts[re])) {
                        return nodePath.relative(outputFolder, nodePath.join(selDir, files[f]));
                    }
                }
            }
        } catch (e) { /* skip */ }

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
        if (fontSecondary) {
            xml = setFontOnStyle(xml, 'BRAND_SECONDARY', fontSecondary);
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
     * Process conditional blocks in a Spread XML.
     * Removes named blocks whose data is not available:
     *   BLOCK_COLOR_N   → removed if brand color N does not exist
     *   BLOCK_CUSTOM_N  → removed if custom color N was not changed by user
     *
     * Blocks can be Group, Rectangle, or TextFrame elements.
     * Name them in InDesign's Layers panel.
     */
    function processConditionalBlocks(xml, config) {
        var colors = config.colors || [];
        var maxSlots = 10; // support up to 10 color slots

        for (var i = 1; i <= maxSlots; i++) {
            var colorEntry = colors[i - 1];
            var hasColor = colorEntry && (typeof (colorEntry.original || colorEntry) === 'string');
            var hasCustom = hasColor && colorEntry.custom &&
                colorEntry.custom !== (colorEntry.original || colorEntry);

            if (!hasColor) {
                xml = removeNamedBlock(xml, 'BLOCK_COLOR_' + i);
            }
            if (!hasCustom) {
                xml = removeNamedBlock(xml, 'BLOCK_CUSTOM_' + i);
            }
        }

        return xml;
    }

    /**
     * Remove entire spreads (pages) from the IDML based on conditional markers.
     * Place a small element named PAGE_CUSTOM anywhere on a page in InDesign.
     * If no custom colors were set by the user, that entire spread is removed.
     *
     * Also updates designmap.xml to keep the IDML valid.
     */
    async function processConditionalPages(zip, config) {
        var colors = config.colors || [];
        var hasAnyCustom = false;
        for (var i = 0; i < colors.length; i++) {
            if (colors[i].custom && colors[i].custom !== (colors[i].original || colors[i])) {
                hasAnyCustom = true;
                break;
            }
        }

        // If custom colors exist, keep all pages
        if (hasAnyCustom) return;

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

    // ─── Protection zones ────────────────────────────────────────────

    /**
     * Process protection zone pages in a Spread XML.
     * Finds ZONE_{TYPE}_{COLOR} frames, places the logo, computes rendered
     * bounds, then repositions ZONE_BORDER, ZONE_EXCLUSION, and ZONE_FILL
     * elements to match the actual logo dimensions + configurable margin.
     *
     * Returns the modified XML, or null if the logo doesn't exist
     * (signal to remove the entire page).
     */
    function processProtectionZones(xml, scan, outputFolder, config) {
        var colorMap = {
            'original': 'original',
            'blackwhite': 'blackwhite',
            'monochrome': 'monochrome',
            'monochromelight': 'monochromeLight',
            'custom': 'custom'
        };

        // Find the ZONE_{TYPE}_{COLOR} frame
        var zoneRegex = /(<Rectangle[^>]*?Name="ZONE_\{?([A-Za-z0-9]+)\}?_\{?([A-Za-z]+)\}?"[\s\S]*?<\/Rectangle>)/;
        var zoneMatch = zoneRegex.exec(xml);
        if (!zoneMatch) return xml; // no zone frame on this page

        var rectXml = zoneMatch[1];
        var sel = zoneMatch[2].toLowerCase();
        var col = colorMap[zoneMatch[3].toLowerCase()] || zoneMatch[3].toLowerCase();

        // Check if logo exists
        if (!scan.logos[sel] || !scan.logos[sel][col]) {
            return null; // signal: remove this page
        }

        var relPath = scan.logos[sel][col];
        var absPath = nodePath.join(outputFolder, relPath);

        // 1. Place logo in the ZONE_ frame (same logic as processSpreadXml)
        var uriPath = 'file:///' + absPath.replace(/\\/g, '/').replace(/^\//, '');

        if (rectXml.indexOf('LinkResourceURI=') >= 0) {
            // Frame already has an image — replace URI
            var newRectXml = rectXml.replace(
                /LinkResourceURI="[^"]*"/,
                'LinkResourceURI="' + escXml(uriPath) + '"'
            );
            xml = xml.replace(rectXml, newRectXml);
        } else {
            // Empty graphic frame — insert FrameFittingOption + Image+Link
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

            var zoneImgId = 'uZoneImg_' + sel + '_' + col;
            var zoneLnkId = 'uZoneLnk_' + sel + '_' + col;

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

        // 2. Compute rendered bounds of the logo in the frame
        var bounds = computeLogoRenderedBounds(rectXml, absPath);
        if (!bounds) return xml;

        // 3. Calculate margin (based on largest dimension)
        var marginPct = config.protectionZoneMargin || 15;
        var marginPx = Math.max(bounds.scaledW, bounds.scaledH) * (marginPct / 100);

        // 4. Define target bounds
        var logoBounds = bounds.spread;
        var exclusionBounds = {
            left: logoBounds.left - marginPx,
            top: logoBounds.top - marginPx,
            right: logoBounds.right + marginPx,
            bottom: logoBounds.bottom + marginPx
        };

        // 5. Reposition indicator elements
        xml = repositionNamedRect(xml, 'ZONE_BORDER', logoBounds);
        xml = repositionNamedRect(xml, 'ZONE_EXCLUSION', exclusionBounds);
        xml = repositionNamedRect(xml, 'ZONE_FILL', exclusionBounds);

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

        // Zone margin placeholder
        xml = xml.replace(/\{\{ZONE_MARGIN_PCT\}\}/g, String(config.protectionZoneMargin || 15));

        // Clean up remaining color placeholders (unused slots)
        xml = xml.replace(/\{\{COLOR_\d+_(?:HEX|RGB|CMYK)\}\}/g, '-');
        xml = xml.replace(/\{\{CUSTOM_\d+_(?:HEX|RGB|CMYK)\}\}/g, '-');
        xml = xml.replace(/\{\{MONO_(?:DARK|LIGHT)_(?:HEX|RGB|CMYK)\}\}/g, '-');

        // Replace character-level AppliedFont overrides inside BRAND_PRIMARY / BRAND_SECONDARY ranges
        if (config.fontPrimary) {
            xml = replaceStoryFonts(xml, 'BRAND_PRIMARY', config.fontPrimary);
        }
        if (config.fontSecondary) {
            xml = replaceStoryFonts(xml, 'BRAND_SECONDARY', config.fontSecondary);
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

            // 1. Scan available logos in the output folder
            var scan = scanAvailableLogos(config.outputFolder);

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

            // 4. Process Spread files (image frames)
            var allFiles = Object.keys(zip.files);
            var spreadFiles = allFiles.filter(function (f) {
                return f.indexOf('Spreads/') === 0 && f.endsWith('.xml');
            });

            for (var i = 0; i < spreadFiles.length; i++) {
                var spreadXml = await zip.file(spreadFiles[i]).async('string');
                spreadXml = processConditionalBlocks(spreadXml, config);
                spreadXml = processSpreadXml(spreadXml, scan, config.outputFolder);
                zip.file(spreadFiles[i], spreadXml);
            }

            // Also process MasterSpreads in case placeholders are there
            var masterFiles = allFiles.filter(function (f) {
                return f.indexOf('MasterSpreads/') === 0 && f.endsWith('.xml');
            });
            for (var i = 0; i < masterFiles.length; i++) {
                var masterXml = await zip.file(masterFiles[i]).async('string');
                masterXml = processConditionalBlocks(masterXml, config);
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
                path: outputPath
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
