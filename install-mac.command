#!/bin/bash

# Script d'installation Logo Déclinaisons pour macOS
# Version 1.0.0

echo "================================================"
echo "  Installation Logo Déclinaisons pour Adobe Illustrator"
echo "  Version 1.0.0"
echo "================================================"
echo ""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Chemins
EXTENSION_NAME="logo-declinaisons"
INSTALL_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
TARGET_DIR="$INSTALL_DIR/$EXTENSION_NAME"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "📂 Vérification des prérequis..."

# Vérifier qu'on n'est pas déjà dans le dossier d'installation
if [[ "$SCRIPT_DIR" == *"/CEP/extensions"* ]]; then
    echo -e "${RED}❌ Erreur : Ce script ne doit pas être exécuté depuis le dossier d'installation CEP${NC}"
    echo "   Déplacez d'abord les fichiers vers un autre emplacement (Bureau, Téléchargements, etc.)"
    exit 1
fi

# Créer le dossier CEP/extensions s'il n'existe pas
if [ ! -d "$INSTALL_DIR" ]; then
    echo "📁 Création du dossier CEP/extensions..."
    mkdir -p "$INSTALL_DIR"
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Impossible de créer le dossier d'installation${NC}"
        exit 1
    fi
fi

# Vérifier qu'Illustrator est installé
if [ ! -d "/Applications/Adobe Illustrator 2022" ] && \
   [ ! -d "/Applications/Adobe Illustrator 2023" ] && \
   [ ! -d "/Applications/Adobe Illustrator 2024" ] && \
   [ ! -d "/Applications/Adobe Illustrator 2025" ]; then
    echo -e "${YELLOW}⚠️  Adobe Illustrator n'a pas été détecté${NC}"
    echo "   Le plugin sera installé mais Illustrator doit être installé pour l'utiliser."
    read -p "   Continuer quand même ? (o/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        exit 1
    fi
fi

# Supprimer l'ancienne installation si elle existe
if [ -d "$TARGET_DIR" ]; then
    echo "🗑️  Suppression de l'ancienne installation..."
    rm -rf "$TARGET_DIR"
fi

echo "📦 Installation du plugin..."

# Créer le dossier cible
mkdir -p "$TARGET_DIR"

# Copier tous les fichiers nécessaires
echo "   Copie des fichiers..."

# Liste des dossiers à copier
for dir in CSXS css js jsx lib media; do
    if [ -d "$SCRIPT_DIR/$dir" ]; then
        cp -R "$SCRIPT_DIR/$dir" "$TARGET_DIR/"
        echo "   ✓ $dir/"
    fi
done

# Copier le fichier index.html
if [ -f "$SCRIPT_DIR/index.html" ]; then
    cp "$SCRIPT_DIR/index.html" "$TARGET_DIR/"
    echo "   ✓ index.html"
fi

# Vérifier que le manifest existe
if [ ! -f "$TARGET_DIR/CSXS/manifest.xml" ]; then
    echo -e "${RED}❌ Erreur : Le fichier manifest.xml est manquant${NC}"
    echo "   Installation incomplète. Vérifiez les fichiers sources."
    exit 1
fi

echo ""
echo "🔧 Activation du mode debug CEP..."

# Fonction pour activer le mode debug pour une version CEP
enable_cep_debug() {
    local cep_version=$1
    local plist_file="$HOME/Library/Preferences/com.adobe.CSXS.${cep_version}.plist"

    # Créer ou modifier le plist
    defaults write com.adobe.CSXS.${cep_version} PlayerDebugMode 1

    if [ $? -eq 0 ]; then
        echo "   ✓ CEP ${cep_version} configuré"
    fi
}

# Activer pour toutes les versions CEP
for version in 9 10 11 12; do
    enable_cep_debug $version
done

echo ""
echo "✅ Installation terminée avec succès !"
echo ""
echo "================================================"
echo "  Comment utiliser Logo Déclinaisons :"
echo "================================================"
echo ""
echo "1. Ouvrez Adobe Illustrator"
echo "2. Allez dans : Fenêtre > Extensions > Logo Déclinaisons"
echo "3. Le panneau du plugin s'ouvrira"
echo ""
echo "📍 Emplacement d'installation :"
echo "   $TARGET_DIR"
echo ""
echo "🔄 Si le plugin n'apparaît pas :"
echo "   - Redémarrez complètement Illustrator"
echo "   - Vérifiez que vous utilisez Illustrator 2022 ou plus récent"
echo ""
echo "📧 Support : support@votre-site.com"
echo ""
echo "================================================"
echo ""

# Demander si on veut ouvrir Illustrator
read -p "Voulez-vous ouvrir Adobe Illustrator maintenant ? (o/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    # Trouver la version la plus récente d'Illustrator
    for year in 2025 2024 2023 2022; do
        AI_PATH="/Applications/Adobe Illustrator ${year}/Adobe Illustrator.app"
        if [ -d "$AI_PATH" ]; then
            echo "🚀 Ouverture d'Adobe Illustrator ${year}..."
            open "$AI_PATH"
            break
        fi
    done
fi

echo ""
echo "Appuyez sur une touche pour fermer..."
read -n 1 -s

exit 0
