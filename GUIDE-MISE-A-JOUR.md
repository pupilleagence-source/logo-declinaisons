# 📦 Guide du Système de Mise à Jour Automatique

## Comment ça fonctionne ?

Le plugin vérifie automatiquement les mises à jour disponibles **2 secondes après le démarrage** d'Illustrator.

Si une nouvelle version est disponible :
1. ✅ Une popup s'affiche avec les informations de la nouvelle version
2. ✅ L'utilisateur peut télécharger immédiatement ou ignorer
3. ✅ Si ignoré, la popup ne s'affiche plus jusqu'au prochain redémarrage d'Illustrator

---

## 🚀 Comment publier une nouvelle version ?

### Étape 1 : Mettre à jour le numéro de version

**Fichier 1 : `CSXS/manifest.xml`** (ligne 2 et 4)
```xml
<ExtensionManifest Version="11.0" ExtensionBundleId="com.graphiste.logodeclinaisons" ExtensionBundleVersion="1.1.0">
    <ExtensionList>
        <Extension Id="com.graphiste.logodeclinaisons.panel" Version="1.1.0" />
```

**Fichier 2 : `js/updater.js`** (ligne 9)
```javascript
CURRENT_VERSION: '1.1.0',
```

**Fichier 3 : `backend-trial/api/version/latest.js`** (lignes 30-40)
```javascript
const latestVersion = {
    version: '1.1.0',
    releaseDate: '2025-11-15',
    downloadUrl: 'https://votre-domaine.com/downloads/logo-declinaisons-v1.1.0.zxp',
    changelog: [
        'Nouveau : Système de mise à jour automatique',
        'Amélioration : Libération automatique des slots Lemon Squeezy',
        'Fix : Correction du stockage de l\'instanceId'
    ]
};
```

### Étape 2 : Compiler le nouveau .zxp

```bash
# Windows
.\create-zxp-simple.bat

# Le fichier sera généré : logo-declinaisons.zxp
```

### Étape 3 : Upload le .zxp

Uploadez le fichier `logo-declinaisons.zxp` sur votre serveur et obtenez l'URL publique.

**Exemples d'hébergement :**
- GitHub Releases : `https://github.com/username/repo/releases/download/v1.1.0/logo-declinaisons.zxp`
- Votre propre serveur : `https://votre-domaine.com/downloads/logo-declinaisons-v1.1.0.zxp`
- Google Drive (lien public direct)
- Dropbox (lien public direct)

### Étape 4 : Mettre à jour l'API

Modifiez `backend-trial/api/version/latest.js` avec la nouvelle URL de téléchargement.

### Étape 5 : Déployer l'API

```bash
cd backend-trial
vercel --prod
```

✅ **C'est tout !** Les utilisateurs recevront automatiquement la notification au prochain démarrage.

---

## 🧪 Tester le système de mise à jour

### Test 1 : Simuler une nouvelle version

1. Modifiez `backend-trial/api/version/latest.js` :
```javascript
version: '99.99.99',  // Version très élevée
```

2. Déployez : `vercel --prod`
3. Relancez Illustrator
4. ✅ La popup de mise à jour devrait apparaître après 2 secondes

### Test 2 : Vérifier l'API directement

Ouvrez dans votre navigateur :
```
https://logotyps.vercel.app/api/version/latest
```

Vous devriez voir :
```json
{
  "version": "1.0.0",
  "releaseDate": "2025-11-07",
  "downloadUrl": "https://...",
  "changelog": [...]
}
```

---

## 📝 Format de version

Le système utilise le format **Semantic Versioning** (x.y.z) :
- `1.0.0` → `1.0.1` = Patch (correction de bugs)
- `1.0.0` → `1.1.0` = Minor (nouvelles fonctionnalités)
- `1.0.0` → `2.0.0` = Major (changements importants/breaking)

**Important** : Le système compare uniquement les 3 premiers chiffres (x.y.z).

---

## 🔧 Personnalisation

### Changer le délai de vérification

Dans `js/updater.js` ligne 120 :
```javascript
setTimeout(async () => {
    const updateInfo = await this.checkForUpdates();
    if (updateInfo) {
        this.showUpdateModal(updateInfo);
    }
}, 2000); // 2000ms = 2 secondes
```

### Désactiver la vérification automatique

Commentez l'appel à `init()` dans `js/updater.js` :
```javascript
// UpdateChecker.init(); // ← Désactivé
```

---

## 🎯 Bonnes pratiques

1. **Toujours tester** la nouvelle version avant de la publier
2. **Vérifier** que l'URL de téléchargement fonctionne
3. **Rédiger** un changelog clair et compréhensible
4. **Garder** une copie de chaque .zxp publié
5. **Incrémenter** correctement le numéro de version

---

## ❓ FAQ

**Q : Les utilisateurs doivent-ils télécharger manuellement ?**
R : Oui, car Adobe CEP ne permet pas l'auto-installation. Le plugin ouvre simplement le navigateur avec le .zxp.

**Q : Que se passe-t-il si l'API est down ?**
R : Le plugin fonctionne normalement, la vérification échoue silencieusement (timeout 5s).

**Q : Peut-on forcer une mise à jour obligatoire ?**
R : Oui, il faudrait modifier le code pour bloquer l'utilisation si version < minimum requis.

**Q : Où sont stockées les infos de version ?**
R : Nulle part côté client (sessionStorage uniquement pour "ignorer cette session").

---

## 🌐 Endpoints API

- **Check version** : `GET https://logotyps.vercel.app/api/version/latest`
- **Returns** :
```json
{
  "version": "string",
  "releaseDate": "YYYY-MM-DD",
  "downloadUrl": "string",
  "changelog": ["string"]
}
```

---

**Vous êtes prêt !** 🎉

Pour toute question, consultez le code dans `js/updater.js` qui est bien commenté.
