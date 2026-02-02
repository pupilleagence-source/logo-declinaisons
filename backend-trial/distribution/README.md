# 📦 Dossier de Distribution des Mises à Jour

Ce dossier contient les fichiers qui seront distribués lors des mises à jour automatiques.

## 📋 Utilisation

### 1. Préparer une nouvelle version

Copiez les fichiers modifiés dans ce dossier avec la même structure que le plugin :

```
distribution/
├── main.js           → sera copié dans js/main.js
├── index.html        → sera copié dans index.html
├── hostscript.jsx    → sera copié dans jsx/hostscript.jsx
├── styles.css        → sera copié dans css/styles.css
└── ...
```

### 2. Calculer les checksums

Pour chaque fichier, calculez son checksum SHA-256 :

**Windows (PowerShell) :**
```powershell
Get-FileHash -Algorithm SHA256 main.js
```

**Mac/Linux :**
```bash
shasum -a 256 main.js
```

### 3. Mettre à jour le manifest

Éditez `api/updates/manifest.js` :

```javascript
const manifest = {
    version: '1.1.0',  // Nouvelle version
    releaseDate: '2025-11-15',
    changelog: [
        'Correction bug génération',
        'Nouvelle fonctionnalité export'
    ],
    files: [
        {
            path: 'js/main.js',
            url: 'https://logotyps.vercel.app/api/updates/files?file=main.js',
            checksum: 'abc123...'  // Checksum calculé
        },
        {
            path: 'jsx/hostscript.jsx',
            url: 'https://logotyps.vercel.app/api/updates/files?file=hostscript.jsx',
            checksum: 'def456...'
        }
    ]
};
```

### 4. Déployer

```bash
cd backend-trial
vercel --prod
```

✅ **Les utilisateurs auront automatiquement la nouvelle version au prochain lancement !**

---

## 🔐 Sécurité

- Les checksums garantissent l'intégrité des fichiers
- Les chemins sont validés pour éviter les path traversal
- Seuls les fichiers de ce dossier peuvent être distribués

---

## 📝 Exemple Complet

**Scénario : Corriger un bug dans main.js**

1. Modifiez `../../js/main.js` localement
2. Testez la correction dans Illustrator
3. Copiez le fichier corrigé :
   ```bash
   cp ../../js/main.js ./main.js
   ```
4. Calculez le checksum :
   ```bash
   shasum -a 256 main.js
   # Résultat : 7d8e9f...
   ```
5. Modifiez `api/updates/manifest.js` :
   ```javascript
   {
       path: 'js/main.js',
       url: 'https://logotyps.vercel.app/api/updates/files?file=main.js',
       checksum: '7d8e9f...'
   }
   ```
6. Déployez :
   ```bash
   vercel --prod
   ```

🎉 **Terminé !** Les utilisateurs auront le fix au prochain lancement d'Illustrator.
