> **AVERTISSEMENT (2026-09-04)** : deux erreurs graves dans ce guide.
> 1. Les chemins de copie sont PLATS (`backend-trial/distribution/main.js`) alors que
>    l'arborescence reelle est IMBRIQUEE (`backend-trial/distribution/js/main.js`).
>    Suivre ce guide cree des orphelins et laisse le payload servi inchange.
> 2. Il decrit l'updater in-place comme actif. Il ne l'est PAS : `installUpdate()` n'a
>    aucun appelant, le bouton ouvre simplement le navigateur. Voir `CLAUDE.md` section 2.3
>    avant de toucher a `backend-trial/distribution/`.

# 🚀 Guide du Système de Mise à Jour Automatique

## 🎯 Vue d'ensemble

Le plugin dispose maintenant d'un **système de mise à jour automatique** qui permet de remplacer les fichiers (HTML, JSX, JS, CSS) **sans réinstallation .zxp**.

### Comment ça marche ?

1. **Utilisateur lance Illustrator** → Plugin vérifie automatiquement s'il y a une nouvelle version
2. **Nouvelle version disponible** → Popup s'affiche avec détails
3. **User clique "Télécharger la mise à jour"** → Fichiers se téléchargent et remplacent automatiquement
4. **User relance Illustrator** → Nouvelle version chargée ! ✅

---

## 📋 Publier une nouvelle version (Guide Complet)

### Étape 1 : Préparer les fichiers modifiés

Copiez tous les fichiers que vous avez modifiés dans le dossier `backend-trial/distribution/` :

```bash
# Exemple : Vous avez modifié main.js et hostscript.jsx
cp js/main.js backend-trial/distribution/main.js
cp jsx/hostscript.jsx backend-trial/distribution/hostscript.jsx
```

**Structure du dossier distribution :**
```
backend-trial/distribution/
├── main.js           → sera copié dans js/main.js
├── index.html        → sera copié dans index.html
├── hostscript.jsx    → sera copié dans jsx/hostscript.jsx
├── styles.css        → sera copié dans css/styles.css
└── ...
```

---

### Étape 2 : Calculer les checksums

Pour chaque fichier, calculez son checksum SHA-256 :

**Windows (PowerShell) :**
```powershell
cd backend-trial\distribution
Get-FileHash -Algorithm SHA256 main.js
Get-FileHash -Algorithm SHA256 hostscript.jsx
```

**Mac/Linux (Terminal) :**
```bash
cd backend-trial/distribution
shasum -a 256 main.js
shasum -a 256 hostscript.jsx
```

**Exemple de résultat :**
```
7d8e9fa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6  main.js
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8  hostscript.jsx
```

---

### Étape 3 : Mettre à jour le manifest de mise à jour

Éditez `backend-trial/api/updates/manifest.js` :

```javascript
const manifest = {
    version: '1.1.0',  // ← NOUVELLE VERSION
    releaseDate: '2025-11-15',  // ← DATE DU JOUR
    changelog: [
        'Correction du bug de génération multiple',
        'Amélioration de la performance des couleurs',
        'Ajout de nouveaux formats d\'export'
    ],
    files: [
        {
            path: 'js/main.js',  // Chemin dans le plugin
            url: 'https://logotyps.vercel.app/api/updates/files?file=main.js',
            checksum: '7d8e9fa1...'  // ← CHECKSUM calculé
        },
        {
            path: 'jsx/hostscript.jsx',
            url: 'https://logotyps.vercel.app/api/updates/files?file=hostscript.jsx',
            checksum: 'a1b2c3d4...'  // ← CHECKSUM calculé
        }
    ]
};
```

**IMPORTANT** : N'oubliez pas de mettre à jour aussi `backend-trial/api/version/latest.js` avec la même version !

---

### Étape 4 : Déployer sur Vercel

```bash
cd backend-trial
vercel --prod
```

Attendez que le déploiement se termine (~30 secondes).

---

### Étape 5 : Tester

1. **Ouvrez Illustrator** avec le plugin
2. **Attendez 2 secondes** → La popup de mise à jour devrait apparaître
3. **Cliquez "Télécharger la mise à jour"** → Progression s'affiche
4. **Message de succès** apparaît
5. **Fermez et rouvrez Illustrator**
6. **Vérifiez** que les modifications sont bien appliquées

---

## 🧪 Tester en local avant déploiement

### Option 1 : Tester l'API manifest

```bash
# Vérifier que le manifest est valide
curl https://logotyps.vercel.app/api/updates/manifest
```

**Résultat attendu :**
```json
{
  "version": "1.1.0",
  "releaseDate": "2025-11-15",
  "changelog": [...],
  "files": [...]
}
```

### Option 2 : Tester le téléchargement d'un fichier

```bash
# Télécharger un fichier de test
curl "https://logotyps.vercel.app/api/updates/files?file=main.js" -o test-main.js
```

---

## 📝 Workflow Complet (Exemple)

**Scénario : Corriger un bug dans la génération**

### 1. Modification locale
```bash
# Éditez js/main.js
# Testez dans Illustrator
```

### 2. Préparation
```bash
# Copiez le fichier dans distribution
cp js/main.js backend-trial/distribution/main.js

# Calculez le checksum
cd backend-trial/distribution
shasum -a 256 main.js
# Résultat : abc123def456...
```

### 3. Mise à jour du manifest
```javascript
// backend-trial/api/updates/manifest.js
{
    version: '1.0.1',  // Increment patch
    releaseDate: '2025-11-15',
    changelog: ['Fix: Correction bug génération multiple'],
    files: [{
        path: 'js/main.js',
        url: 'https://logotyps.vercel.app/api/updates/files?file=main.js',
        checksum: 'abc123def456...'
    }]
}

// backend-trial/api/version/latest.js
{
    version: '1.0.1',  // Même version
    ...
}
```

### 4. Déploiement
```bash
cd backend-trial
vercel --prod
```

### 5. Résultat
✅ **Tous les utilisateurs auront le fix au prochain lancement d'Illustrator !**

---

## 🔧 Que peut-on mettre à jour ?

### ✅ Updatable automatiquement

- `js/*.js` - Tous les scripts JavaScript
- `jsx/*.jsx` - Scripts ExtendScript
- `index.html` - Structure HTML
- `css/*.css` - Styles
- Images, assets, etc.

### ❌ Nécessite réinstallation .zxp

- `CSXS/manifest.xml` - Manifest CEP
- `.debug` - Configuration debug

**Stratégie** : Garder manifest.xml stable, tout le reste peut être mis à jour.

---

## 🛡️ Sécurité

### Vérifications automatiques

1. **Checksum SHA-256** - Vérifie l'intégrité de chaque fichier
2. **Sauvegarde automatique** - Rollback si échec
3. **Path validation** - Protection contre path traversal
4. **HTTPS uniquement** - Pas d'interception

### En cas d'échec

- **Rollback automatique** - Fichiers originaux restaurés
- **Message d'erreur détaillé** - Pour debugging
- **Fallback manuel** - Bouton "Télécharger manuellement" apparaît

---

## 🐛 Troubleshooting

### Problème : "Impossible de récupérer le manifest"

**Cause** : API Vercel inaccessible
**Solution** :
- Vérifiez que le déploiement Vercel est terminé
- Testez l'URL : `https://logotyps.vercel.app/api/updates/manifest`

### Problème : "Checksum mismatch"

**Cause** : Fichier corrompu ou checksum incorrect
**Solution** :
- Recalculez le checksum du fichier
- Mettez à jour le manifest avec le bon checksum

### Problème : "Fichier locké" (Windows)

**Cause** : Fichier utilisé par Illustrator
**Solution** :
- Le système crée automatiquement un fichier .pending
- Au prochain démarrage, le fichier sera remplacé

### Problème : "Mise à jour ne s'applique pas"

**Cause** : Fichiers .pending non traités
**Solution** :
- Fermez complètement Illustrator
- Rouvrez Illustrator
- Les fichiers .pending seront automatiquement appliqués

---

## 📊 Versionning (Semantic Versioning)

```
v1.2.3
│ │ │
│ │ └─ Patch   : Bug fixes (1.2.3 → 1.2.4)
│ └─── Minor   : New features (1.2.0 → 1.3.0)
└───── Major   : Breaking changes (1.0.0 → 2.0.0)
```

**Exemples** :
- Correction bug → `1.0.0` → `1.0.1` (patch)
- Nouvelle fonctionnalité → `1.0.0` → `1.1.0` (minor)
- Refonte majeure → `1.0.0` → `2.0.0` (major)

---

## ✅ Checklist avant Publication

- [ ] Fichiers modifiés copiés dans `distribution/`
- [ ] Checksums calculés
- [ ] `manifest.js` mis à jour (version, checksums, changelog)
- [ ] `version/latest.js` mis à jour (même version)
- [ ] Testé en local (curl API)
- [ ] Déployé sur Vercel (`vercel --prod`)
- [ ] Testé dans Illustrator
- [ ] Changelog clair et compréhensible

---

## 🎉 Avantages de ce système

1. **Zéro friction utilisateur** - Click "Mettre à jour" → Relancer Illustrator
2. **Déploiement instantané** - Tous les utilisateurs ont la nouvelle version en quelques minutes
3. **Rollback facile** - Problème détecté ? Revertez le manifest, redéployez
4. **Offline compatible** - Système de cache local
5. **Sécurisé** - Checksums, sauvegardes automatiques
6. **Logging complet** - Debug facile en cas de problème

---

**🚀 Vous êtes prêt à déployer des mises à jour ultra-rapides !**

Pour toute question, consultez :
- `backend-trial/distribution/README.md` - Guide du dossier de distribution
- `js/auto-updater.js` - Code source commenté
- `js/updater.js` - Système de vérification de version
