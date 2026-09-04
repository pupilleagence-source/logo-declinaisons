> **AVERTISSEMENT (2026-09-04)** : ce guide est en grande partie perime. Il decrit le canal
> ZXP et un build manuel anterieurs a la CI GitHub Actions. La procedure de release reelle
> est documentee dans `CLAUDE.md` section 8. Ne suivez ce fichier que pour le contexte historique.

# 📦 GUIDE DE DISTRIBUTION - Logo Déclinaisons

## Vue d'ensemble

Vous avez maintenant **2 versions** de votre plugin :
- ✅ **Windows** : Installateur `.exe` (Inno Setup)
- ✅ **Mac** : Scripts `.command` + fichiers

---

## 🪟 DISTRIBUTION WINDOWS

### Fichier à distribuer

**Fichier** : `dist/LogoDeclinaisons-Setup-1.0.0.exe` (2 MB environ)

### Comment le mettre à jour

1. Modifiez vos fichiers sources si nécessaire
2. Clic-droit sur `installer.iss`
3. Cliquez "Compile"
4. Le nouveau `.exe` est généré dans `dist/`

### Ce que fait l'installateur

- ✅ Installe tous les fichiers dans `%AppData%\Adobe\CEP\extensions\logo-declinaisons`
- ✅ Active automatiquement le mode debug CEP (registre)
- ✅ Crée un désinstallateur
- ✅ Génère un README.txt
- ✅ Ne nécessite PAS les droits administrateur

### Note importante

❗ **Warning Windows SmartScreen** : Votre `.exe` affichera un warning "Windows a protégé votre PC"

**Solution pour vos clients** :
1. Ajouter sur votre page de téléchargement :
   - Instructions avec screenshots
   - "Cliquez sur 'Informations complémentaires' puis 'Exécuter quand même'"
   - Expliquer que c'est normal pour développeurs indépendants

2. **Après 100+ téléchargements** : Le warning disparaît automatiquement (réputation)

3. **Option premium** : Acheter certificat Code Signing (~200€/an) pour éliminer le warning

---

## 🍎 DISTRIBUTION MAC

### Créer le package de distribution

**Sur Windows (ce que vous devez faire maintenant)** :

1. Créez un dossier `LogoDeclinaisons-Mac-1.0.0`

2. Copiez-y ces fichiers :
   ```
   LogoDeclinaisons-Mac-1.0.0/
   ├── install-mac.command              ← Script d'installation
   ├── enable-cep-debug-mac.command     ← Script debug mode
   ├── README-MAC.txt                   ← Instructions
   ├── CSXS/
   ├── css/
   ├── js/
   ├── jsx/
   ├── lib/
   ├── media/
   └── index.html
   ```

3. Créez une archive ZIP :
   - Sélectionnez le dossier `LogoDeclinaisons-Mac-1.0.0`
   - Clic-droit > Envoyer vers > Dossier compressé
   - Nommez : `LogoDeclinaisons-Mac-1.0.0.zip`

4. **Ce ZIP est prêt pour distribution !**

### Ce que fait le package Mac

Quand un utilisateur Mac télécharge et décompresse :

1. Double-clic sur `install-mac.command`
2. Le script :
   - Copie tous les fichiers dans `~/Library/Application Support/Adobe/CEP/extensions/`
   - Active le mode debug CEP (plist files)
   - Affiche les instructions
   - Propose d'ouvrir Illustrator

### Rendre les scripts exécutables (Sur Mac uniquement)

**Important** : Si vous testez sur un Mac, exécutez d'abord :

```bash
chmod +x install-mac.command
chmod +x enable-cep-debug-mac.command
```

---

## 📁 STRUCTURE FINALE DE DISTRIBUTION

### Pour vos clients

Vous aurez **2 fichiers** à télécharger sur votre site :

```
├── 🪟 LogoDeclinaisons-Setup-1.0.0.exe           (Windows)
└── 🍎 LogoDeclinaisons-Mac-1.0.0.zip             (Mac)
```

---

## 🌐 PAGE DE TÉLÉCHARGEMENT RECOMMANDÉE

### Exemple de structure HTML

```markdown
# Télécharger Logo Déclinaisons v1.0.0

## Windows
[⬇️ Télécharger pour Windows (2 MB)](LogoDeclinaisons-Setup-1.0.0.exe)

**Installation** :
1. Téléchargez le fichier .exe
2. Double-cliquez pour installer
3. Si Windows affiche "Windows a protégé votre PC" :
   - Cliquez "Informations complémentaires"
   - Puis "Exécuter quand même"
4. Suivez l'assistant d'installation
5. Ouvrez Illustrator > Fenêtre > Extensions > Logo Déclinaisons

## macOS
[⬇️ Télécharger pour Mac (1.5 MB)](LogoDeclinaisons-Mac-1.0.0.zip)

**Installation** :
1. Téléchargez et décompressez le fichier .zip
2. Double-cliquez sur `install-mac.command`
3. Si macOS bloque le script :
   - Clic-droit > Ouvrir
   - Ou Préférences Système > Sécurité > "Ouvrir quand même"
4. Suivez les instructions à l'écran
5. Ouvrez Illustrator > Fenêtre > Extensions > Logo Déclinaisons

## Configuration requise
- Adobe Illustrator 2022, 2023, 2024 ou 2025
- Windows 10/11 ou macOS 10.14+
```

---

## 🔄 MISES À JOUR

### Comment créer une mise à jour

**Windows** :
1. Ne modifiez PAS `installer.iss` a la main : la CI passe la version via `iscc /DMyAppVersion=<v>`. Pour un build local : `iscc /DMyAppVersion=1.1.0 installer.iss` (sans ce flag, l'installeur est estampille 1.0.0).
2. Recompilez
3. Nouveau fichier : `LogoDeclinaisons-Setup-1.0.1.exe`

**Mac** :
1. Modifiez la version dans `install-mac.command` (ligne 4)
2. Créez nouveau ZIP avec nouveau numéro de version
3. Nouveau fichier : `LogoDeclinaisons-Mac-1.0.1.zip`

**Communication aux clients** :
- Email annonçant la mise à jour
- Lien de téléchargement de la nouvelle version
- Liste des changements (changelog)

---

## 🧪 TESTS RECOMMANDÉS

### Avant chaque release

**Windows** :
- [ ] Tester l'installation sur un PC propre
- [ ] Vérifier que le plugin apparaît dans Illustrator
- [ ] Tester toutes les fonctionnalités
- [ ] Vérifier la désinstallation

**Mac** :
- [ ] Tester sur Mac Intel si possible
- [ ] Tester sur Mac Apple Silicon (M1/M2) si possible
- [ ] Vérifier les permissions des scripts
- [ ] Tester toutes les fonctionnalités

---

## 📝 CHECKLIST PRE-LANCEMENT

Avant de distribuer publiquement :

- [ ] Versions Windows et Mac créées
- [ ] Testées sur machines propres
- [ ] Page de téléchargement prête
- [ ] Instructions claires avec screenshots
- [ ] Vidéo démo d'installation (optionnel mais recommandé)
- [ ] Email de support configuré
- [ ] Système de licensing prêt (prochaine étape)

---

## 🎯 PROCHAINES ÉTAPES

**Maintenant que vous avez les installateurs** :

1. ✅ **Windows** : Fonctionnel avec `.exe`
2. ✅ **Mac** : Scripts prêts (à tester sur Mac)
3. ⏳ **Licensing** : Prochaine phase (trial + activation)
4. ⏳ **Site web** : Page produit + téléchargement
5. ⏳ **Paiement** : Intégration Lemon Squeezy

---

## 💡 ASTUCES

### Nommage des fichiers

Toujours inclure le numéro de version dans le nom du fichier :
- ✅ `LogoDeclinaisons-Setup-1.0.0.exe`
- ❌ `LogoDeclinaisons-Setup.exe`

**Pourquoi** : Les utilisateurs sauront quelle version ils ont téléchargée

### Hébergement des fichiers

**Options recommandées** :
- Votre propre serveur/hébergement
- Lemon Squeezy (peut héberger les fichiers pour vous)
- GitHub Releases (gratuit, public)

---

## 📞 SUPPORT

Préparez-vous à répondre à ces questions fréquentes :

1. **"Le plugin n'apparaît pas"**
   → Vérifier version Illustrator (2022+)
   → Redémarrer complètement Illustrator

2. **"Windows bloque l'installation"**
   → Instructions "Informations complémentaires" > "Exécuter quand même"

3. **"Le panneau est vide sur Mac"**
   → Lancer `enable-cep-debug-mac.command`
   → Redémarrer Illustrator

4. **"Comment désinstaller ?"**
   → Windows : Panneau de configuration > Programmes
   → Mac : Supprimer dossier ~/Library/.../logo-declinaisons

---

**Vous êtes maintenant prêt à distribuer votre plugin ! 🚀**
