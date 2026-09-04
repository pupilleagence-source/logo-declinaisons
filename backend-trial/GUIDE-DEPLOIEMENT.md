> **AVERTISSEMENT (2026-09-04)** : perime, meme raison que `README.md` de ce dossier.
> Le deploiement reel est `cd backend-trial && vercel --prod` depuis cette machine
> (le CLI televerse le working copy). Voir `CLAUDE.md` section 8.

# Guide de déploiement - Étape par étape

## ✅ Checklist rapide

- [ ] Compte Vercel créé
- [ ] Vercel CLI installé
- [ ] Projet déployé
- [ ] Base de données KV créée
- [ ] Endpoints testés
- [ ] URL mise à jour dans l'extension

---

## 📋 Étapes détaillées

### Étape 1 : Créer un compte Vercel (2 minutes)

1. Aller sur **https://vercel.com**
2. Cliquer sur **Sign Up**
3. Choisir **Continue with GitHub** (ou email si vous préférez)
4. Autoriser l'accès
5. ✅ Vous êtes connecté !

### Étape 2 : Installer Vercel CLI (1 minute)

Ouvrir un terminal (Command Prompt ou PowerShell) et exécuter :

```bash
npm install -g vercel
```

Attendre que l'installation se termine (ça prend ~30 secondes).

### Étape 3 : Se connecter à Vercel (1 minute)

Dans le terminal, exécuter :

```bash
vercel login
```

Choisir votre méthode de connexion (GitHub, GitLab, ou Email).

Si vous choisissez Email, vous recevrez un email de confirmation → cliquer sur le lien.

### Étape 4 : Déployer le projet (2 minutes)

1. **Aller dans le dossier backend** :

```bash
cd "C:\Users\huglg\AppData\Roaming\Adobe\CEP\extensions\logo-declinaisons\backend-trial"
```

2. **Installer les dépendances** :

```bash
npm install
```

3. **Déployer en production** :

```bash
vercel --prod
```

Vercel va vous poser quelques questions :

**Q: Set up and deploy "..."?**
→ Répondre : **Y** (Yes)

**Q: Which scope do you want to deploy to?**
→ Appuyer sur **Entrée** (sélectionner votre compte)

**Q: Link to existing project?**
→ Répondre : **N** (No, créer un nouveau projet)

**Q: What's your project's name?**
→ Tapez : **logo-declinaisons-trial** (ou autre nom)

**Q: In which directory is your code located?**
→ Appuyer sur **Entrée** (./ est correct)

Vercel va déployer... ⏳ (ça prend 30 secondes)

✅ **Succès !** Vous verrez :

```
✅ Production: https://logo-declinaisons-trial.vercel.app [copied to clipboard]
```

**🎉 NOTEZ CETTE URL !** Elle sera nécessaire plus tard.

### Étape 5 : Créer la base de données KV (3 minutes)

1. Aller sur **https://vercel.com/dashboard**

2. Cliquer sur votre projet **logo-declinaisons-trial**

3. Cliquer sur l'onglet **Storage** (dans le menu du haut)

4. Cliquer sur **Create Database**

5. Sélectionner **KV** (l'icône avec Redis)

6. **Nom** : Tapez `trial-storage`

7. **Region** : Sélectionnez une région proche (ex: `Frankfurt, Germany` pour l'Europe)

8. Cliquer sur **Create**

✅ La base de données est créée !

9. Cliquer sur **Connect Project** (en haut à droite)

10. Sélectionner votre projet **logo-declinaisons-trial**

11. Cliquer sur **Connect**

✅ La base de données est maintenant liée au projet !

### Étape 6 : Redéployer (30 secondes)

Après avoir créé la base KV, il faut redéployer pour que les variables d'environnement soient injectées.

Dans le terminal, exécuter à nouveau :

```bash
vercel --prod
```

Cette fois, ça sera beaucoup plus rapide (~10 secondes).

✅ **Le backend est prêt !**

### Étape 7 : Tester les endpoints (2 minutes)

**Option 1 : Tester avec PowerShell**

Ouvrir PowerShell et exécuter (remplacer `VOTRE-URL` par l'URL de votre projet) :

```powershell
$body = @{hwid="HWID-test123"} | ConvertTo-Json
Invoke-RestMethod -Uri "https://logotyps-4z4eznm8f-pupilleagence-sources-projects.vercel.app /api/trial/check" -Method Post -Body $body -ContentType "application/json"
```

Vous devriez voir :

```
success             : True
generationsUsed     : 0
generationsLimit    : 7
generationsRemaining: 7
```

✅ **Ça fonctionne !**

Tester l'incrémentation :

```powershell
Invoke-RestMethod -Uri "https://VOTRE-URL.vercel.app/api/trial/increment" -Method Post -Body $body -ContentType "application/json"
```

Vous devriez voir :

```
success             : True
generationsUsed     : 1
generationsLimit    : 7
generationsRemaining: 6
```

✅ **Parfait !**

**Option 2 : Tester depuis le navigateur**

Vous pouvez aussi utiliser un outil en ligne comme :
- **https://reqbin.com** (simple et gratuit)
- **Postman** (si vous l'avez installé)

### Étape 8 : Mettre à jour l'extension (2 minutes)

1. Ouvrir le fichier `js/trial.js` (dans le dossier principal de l'extension)

2. Ligne 11, remplacer l'URL par la vôtre :

**AVANT :**
```javascript
serverURL: 'https://your-vercel-app.vercel.app/api/trial',
```

**APRÈS :**
```javascript
serverURL: 'https://logo-declinaisons-trial.vercel.app/api/trial',
```
*(Remplacer par VOTRE URL obtenue à l'étape 4)*

3. Sauvegarder le fichier

### Étape 9 : Recréer le ZXP (1 minute)

Pour que les utilisateurs aient la nouvelle configuration avec le serveur :

1. Double-cliquer sur **create-zxp-simple.bat**

2. Attendre que le ZXP soit créé

3. ✅ Le nouveau ZXP est dans le dossier `dist/`

---

## 🎉 C'est terminé !

Votre système de trial est maintenant 100% fonctionnel :

✅ Backend Vercel déployé
✅ Base de données KV active
✅ Extension CEP connectée au serveur
✅ Trial de 7 générations gratuites opérationnel

### Prochaines étapes possibles :

1. **Monitoring** : Aller sur https://vercel.com/dashboard pour voir les statistiques d'utilisation
2. **Logs** : Voir les logs en temps réel des appels API
3. **Analytics** : Suivre combien d'utilisateurs utilisent le trial

---

## 🆘 En cas de problème

**Erreur "Vercel command not found"**
→ Relancer le terminal après l'installation de Vercel CLI

**Erreur "KV_REST_API_URL is not defined"**
→ Vous avez oublié de créer la base KV (Étape 5) ou de redéployer (Étape 6)

**Erreur CORS dans l'extension**
→ Vérifier que l'URL dans `trial.js` est correcte et contient bien `https://`

**Le compteur ne s'incrémente pas**
→ Ouvrir les DevTools de l'extension (F12) et vérifier les erreurs réseau

---

**Besoin d'aide ?** Consultez le README.md pour plus de détails techniques.
