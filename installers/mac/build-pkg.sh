#!/bin/bash
# Build & sign a macOS .pkg installer for Logo Declinaisons CEP extension
# Runs on macOS (GitHub Actions runner or local Mac)

set -e

# Config
APP_NAME="Logo Declinaisons"
BUNDLE_ID="com.graphiste.logodeclinaisons"
VERSION="${VERSION:-1.1.0}"
INSTALL_DIR="/Library/Application Support/Adobe/CEP/extensions/logo-declinaisons"
PKG_OUTPUT="dist/LogoDeclinaisons-${VERSION}-mac.pkg"

# Signing (set via env vars or GitHub Secrets)
DEVELOPER_ID="${APPLE_DEVELOPER_ID_INSTALLER:-}"          # "Developer ID Installer: Your Name (TEAMID)"
APPLICATION_ID="${APPLE_DEVELOPER_ID_APPLICATION:-}"      # "Developer ID Application: Your Name (TEAMID)" — for the stub binary
APPLE_ID="${APPLE_ID:-}"
APPLE_PASSWORD="${APPLE_APP_PASSWORD:-}"  # App-specific password
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "================================================"
echo "  Building macOS installer"
echo "  ${APP_NAME} v${VERSION}"
echo "================================================"

# 1. Prepare payload
echo "Preparing payload..."
PAYLOAD_DIR=$(mktemp -d)
DEST="${PAYLOAD_DIR}${INSTALL_DIR}"
mkdir -p "$DEST"

# Copy extension files
cp "$PROJECT_ROOT/index.html" "$DEST/"
cp -R "$PROJECT_ROOT/CSXS" "$DEST/"
cp -R "$PROJECT_ROOT/css" "$DEST/"
cp -R "$PROJECT_ROOT/js" "$DEST/"
cp -R "$PROJECT_ROOT/jsx" "$DEST/"
cp -R "$PROJECT_ROOT/lib" "$DEST/"
cp -R "$PROJECT_ROOT/media" "$DEST/"
mkdir -p "$DEST/templates"
cp "$PROJECT_ROOT/templates/"*.idml "$DEST/templates/" 2>/dev/null || true
# Mockups PSD are NOT included (too large) — downloaded separately if needed

# 1.5 Compile a tiny universal Mach-O stub so the .pkg has a signed executable
#     for Apple's notary to staple a ticket to. Without this, notarization fails
#     with "Package has no signed executables or bundles".
if [ -n "$APPLICATION_ID" ]; then
    echo "Compiling signed stub binary..."
    STUB_SRC=$(mktemp -t stub.XXXXXX).c
    cat > "$STUB_SRC" << 'STUBC'
#include <stdio.h>
int main(int argc, char **argv) {
    (void)argc; (void)argv;
    return 0;
}
STUBC
    STUB_BIN_DIR="$DEST/bin"
    mkdir -p "$STUB_BIN_DIR"
    STUB_BIN="$STUB_BIN_DIR/logo-declinaisons-helper"

    # Universal binary (Apple Silicon + Intel)
    clang -arch arm64 -arch x86_64 -mmacosx-version-min=10.15 \
          -o "$STUB_BIN" "$STUB_SRC"
    rm -f "$STUB_SRC"

    # Sign with hardened runtime + secure timestamp (required by notary)
    codesign --force --options runtime --timestamp \
             --sign "$APPLICATION_ID" \
             "$STUB_BIN"
    codesign --verify --strict --verbose=2 "$STUB_BIN"
    echo "Stub binary signed: $STUB_BIN"
else
    echo "WARNING: APPLE_DEVELOPER_ID_APPLICATION not set — skipping stub binary (notarization will fail)"
fi

echo "Payload: $(du -sh "$DEST" | cut -f1)"

# 2. Create postinstall script (set PlayerDebugMode for unsigned extensions)
SCRIPTS_DIR=$(mktemp -d)
cat > "$SCRIPTS_DIR/postinstall" << 'POSTINSTALL'
#!/bin/bash
# Enable CEP debug mode for unsigned extensions
for version in 9 10 11 12; do
    defaults write com.adobe.CSXS.${version} PlayerDebugMode 1 2>/dev/null || true
done
exit 0
POSTINSTALL
chmod +x "$SCRIPTS_DIR/postinstall"

# 3. Build the .pkg
echo "Building package..."
mkdir -p "$PROJECT_ROOT/dist"

pkgbuild \
    --root "$PAYLOAD_DIR" \
    --identifier "$BUNDLE_ID" \
    --version "$VERSION" \
    --scripts "$SCRIPTS_DIR" \
    --install-location "/" \
    "${PKG_OUTPUT}.component"

# Wrap in a product archive (nicer installer UI)
COMPONENT_FILENAME="$(basename "${PKG_OUTPUT}.component")"
cat > "/tmp/distribution.xml" << DIST
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
    <title>${APP_NAME}</title>
    <welcome file="welcome.html" />
    <conclusion file="conclusion.html" />
    <options customize="never" require-scripts="false" hostArchitectures="x86_64,arm64" />
    <choices-outline>
        <line choice="default">
            <line choice="${BUNDLE_ID}"/>
        </line>
    </choices-outline>
    <choice id="default"/>
    <choice id="${BUNDLE_ID}" visible="false">
        <pkg-ref id="${BUNDLE_ID}"/>
    </choice>
    <pkg-ref id="${BUNDLE_ID}" version="${VERSION}" onConclusion="none">${COMPONENT_FILENAME}</pkg-ref>
</installer-gui-script>
DIST

# Create welcome/conclusion HTML
RESOURCES_DIR=$(mktemp -d)
cat > "$RESOURCES_DIR/welcome.html" << 'WELCOME'
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px;">
<h2 style="color:#FF6B35;">Logo Declinaisons</h2>
<p>Ce programme va installer l'extension <strong>Logo Declinaisons</strong> pour Adobe Illustrator.</p>
<p style="color:#666;font-size:13px;">L'extension sera disponible dans :<br><em>Fenêtre > Extensions > Logo Déclinaisons</em></p>
</body></html>
WELCOME

cat > "$RESOURCES_DIR/conclusion.html" << 'CONCLUSION'
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px;">
<h2 style="color:#2D8659;">Installation terminée !</h2>
<p>Redémarrez Adobe Illustrator pour voir l'extension.</p>
<p style="color:#666;font-size:13px;">Vous la trouverez dans :<br><em>Fenêtre > Extensions > Logo Déclinaisons</em></p>
</body></html>
CONCLUSION

productbuild \
    --distribution "/tmp/distribution.xml" \
    --resources "$RESOURCES_DIR" \
    --package-path "$(dirname "${PKG_OUTPUT}.component")" \
    "$PKG_OUTPUT.unsigned"

rm -f "${PKG_OUTPUT}.component"

# 4. Sign (if certificate available)
if [ -n "$DEVELOPER_ID" ]; then
    echo "Signing with: $DEVELOPER_ID"
    productsign --sign "$DEVELOPER_ID" "$PKG_OUTPUT.unsigned" "$PKG_OUTPUT"
    rm -f "$PKG_OUTPUT.unsigned"
    echo "Signed: $PKG_OUTPUT"
else
    mv "$PKG_OUTPUT.unsigned" "$PKG_OUTPUT"
    echo "WARNING: Not signed (no APPLE_DEVELOPER_ID_INSTALLER set)"
fi

# 5. Notarize (if credentials available)
if [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ] && [ -n "$DEVELOPER_ID" ]; then
    echo "Submitting for notarization..."
    NOTARY_OUTPUT=$(xcrun notarytool submit "$PKG_OUTPUT" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait 2>&1) || true
    echo "$NOTARY_OUTPUT"

    SUBMISSION_ID=$(echo "$NOTARY_OUTPUT" | awk '/id:/{print $2; exit}')
    STATUS=$(echo "$NOTARY_OUTPUT" | awk '/status:/{print $2}' | tail -1)

    if [ "$STATUS" != "Accepted" ]; then
        echo ""
        echo "============================================"
        echo "  Notarization FAILED — status: $STATUS"
        echo "  Fetching log from Apple for submission $SUBMISSION_ID..."
        echo "============================================"
        xcrun notarytool log "$SUBMISSION_ID" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" || true
        exit 1
    fi

    echo "Stapling notarization ticket..."
    xcrun stapler staple "$PKG_OUTPUT"
    xcrun stapler validate "$PKG_OUTPUT"
    echo "Notarized and stapled!"
else
    echo "WARNING: Skipping notarization (credentials not set)"
fi

# Cleanup
rm -rf "$PAYLOAD_DIR" "$SCRIPTS_DIR" "$RESOURCES_DIR"

echo ""
echo "================================================"
SIZE=$(du -h "$PKG_OUTPUT" | cut -f1)
echo "  Installer: $PKG_OUTPUT ($SIZE)"
echo "================================================"
