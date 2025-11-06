#!/bin/bash

# Active le mode debug CEP pour Adobe Illustrator sur macOS
# Ce script permet aux extensions CEP non signées de fonctionner

echo "================================================"
echo "  Activation du mode debug CEP"
echo "  Pour Adobe Creative Cloud"
echo "================================================"
echo ""

GREEN='\033[0;32m'
NC='\033[0m'

echo "🔧 Configuration du mode debug CEP..."
echo ""

# Activer pour toutes les versions CEP
for version in 9 10 11 12; do
    defaults write com.adobe.CSXS.${version} PlayerDebugMode 1
    echo -e "${GREEN}✓${NC} CEP ${version} : Mode debug activé"
done

echo ""
echo "================================================"
echo "✅ Mode debug CEP activé avec succès !"
echo "================================================"
echo ""
echo "🔄 Prochaine étape :"
echo "   Redémarrez Adobe Illustrator pour appliquer les changements"
echo ""
echo "📝 Note :"
echo "   Ce paramètre permet aux extensions CEP non signées"
echo "   de fonctionner dans les applications Adobe."
echo ""

exit 0
