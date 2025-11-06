# Logo Déclinaisons - Backend Trial API

Backend serverless sur Vercel pour gérer le système de trial (7 générations gratuites).

## Architecture

- **Framework**: Vercel Serverless Functions (Node.js)
- **Base de données**: Vercel KV (Redis)
- **Endpoints**:
  - `POST /api/trial/check` - Vérifie le statut d'un HWID
  - `POST /api/trial/increment` - Incrémente le compteur de générations

## Déploiement sur Vercel

### 1. Créer un compte Vercel (gratuit)

Aller sur [vercel.com](https://vercel.com) et créer un compte (GitHub, GitLab ou email).

### 2. Installer Vercel CLI

```bash
npm install -g vercel
```

### 3. Se connecter à Vercel

```bash
vercel login
```

### 4. Déployer le projet

Depuis le dossier `backend-trial`, exécuter :

```bash
# Installation des dépendances
npm install

# Déploiement en production
vercel --prod
```

Vercel va :
- Détecter automatiquement le projet
- Vous demander de confirmer les paramètres
- Déployer les fonctions serverless
- Vous donner l'URL de production (ex: `https://logo-declinaisons-trial.vercel.app`)

### 5. Configurer Vercel KV (Base de données)

**Important** : Vercel KV doit être activé manuellement.

1. Aller sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionner votre projet `logo-declinaisons-trial`
3. Aller dans l'onglet **Storage**
4. Cliquer sur **Create Database**
5. Sélectionner **KV** (Redis)
6. Nom : `trial-storage` (ou autre)
7. Région : Choisir la plus proche de vos utilisateurs
8. Cliquer sur **Create**

Vercel va automatiquement lier la base de données à votre projet et injecter les variables d'environnement nécessaires.

### 6. Redéployer après configuration KV

Après avoir créé la base KV, redéployer pour que les changements prennent effet :

```bash
vercel --prod
```

### 7. Tester les endpoints

Une fois déployé, tester avec cURL ou Postman :

**Test /api/trial/check :**

```bash
curl -X POST https://VOTRE-URL.vercel.app/api/trial/check \
  -H "Content-Type: application/json" \
  -d '{"hwid":"HWID-test123"}'
```

Réponse attendue :
```json
{
  "success": true,
  "generationsUsed": 0,
  "generationsLimit": 7,
  "generationsRemaining": 7
}
```

**Test /api/trial/increment :**

```bash
curl -X POST https://VOTRE-URL.vercel.app/api/trial/increment \
  -H "Content-Type: application/json" \
  -d '{"hwid":"HWID-test123"}'
```

Réponse attendue :
```json
{
  "success": true,
  "generationsUsed": 1,
  "generationsLimit": 7,
  "generationsRemaining": 6
}
```

### 8. Mettre à jour l'extension CEP

Une fois l'URL de production obtenue, mettre à jour le fichier `js/trial.js` de l'extension :

```javascript
config: {
    freeGenerations: 7,
    gracePeriodDays: 7,
    serverURL: 'https://VOTRE-URL.vercel.app/api/trial', // ← Remplacer par votre URL
},
```

Puis recréer le ZXP avec la nouvelle configuration.

## Développement local

Pour tester en local avant déploiement :

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
vercel dev
```

Le serveur local sera disponible sur `http://localhost:3000`.

**Note** : En développement local, Vercel KV nécessite une configuration supplémentaire. Référez-vous à la [documentation Vercel KV](https://vercel.com/docs/storage/vercel-kv/quickstart).

## Coûts

- **Vercel Hobby (gratuit)** :
  - 100 GB-Heures de fonction serverless/mois
  - Largement suffisant pour des milliers d'utilisateurs

- **Vercel KV (gratuit)** :
  - 30 000 commandes/mois
  - 256 MB de stockage
  - Parfait pour le système de trial

Pour une application avec peu d'utilisateurs, le plan gratuit est amplement suffisant.

## Structure du projet

```
backend-trial/
├── api/
│   └── trial/
│       ├── check.js         # Endpoint pour vérifier le statut
│       └── increment.js     # Endpoint pour incrémenter le compteur
├── package.json             # Dépendances du projet
├── vercel.json              # Configuration Vercel
├── .gitignore
└── README.md
```

## Sécurité

- ✅ CORS activé pour permettre les requêtes depuis l'extension
- ✅ Validation des HWID
- ✅ Rate limiting automatique par Vercel
- ✅ HTTPS automatique
- ✅ Variables d'environnement sécurisées pour KV

## Support

Pour toute question sur le déploiement :
- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Vercel KV](https://vercel.com/docs/storage/vercel-kv)

## Prochaines étapes

Une fois le backend déployé :
1. ✅ Tester les endpoints
2. ✅ Mettre à jour `trial.js` avec l'URL de production
3. ✅ Recréer le ZXP
4. 🔄 Intégrer Lemon Squeezy pour les paiements
5. 🔄 Ajouter l'activation de license
