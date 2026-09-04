# CLAUDE.md — Logo Déclinaisons

> Contexte permanent du projet. Lu automatiquement par Claude Code à chaque session dans ce dossier.
> Versionné dans git → survit à toute purge d'historique de conversation.
> Dernière analyse complète : 2026-09-04 (13 agents, ~1,5 M tokens, lecture intégrale du code).
>
> **Une passe de corrections a été appliquée le 2026-09-04** (commit « Fix verified bugs… »).
> Les bugs corrigés sont marqués ✅ au §10 ; **tout ce qui n'est pas marqué est toujours présent**.
> Aucun de ces correctifs n'a été testé dans Illustrator — ils sont validés syntaxiquement
> et logiquement seulement. **À vérifier au prochain lancement du panneau.**

---

## 1. En une minute

**Logo Déclinaisons** est un plugin **Adobe Illustrator CEP** (panneau HTML/JS + ExtendScript) commercialisé sous licence Lemon Squeezy. L'utilisateur sélectionne un logo dans son document `.ai`, le plugin génère automatiquement toutes les déclinaisons (icône / typo / horizontal / vertical / 3 customs) × (fit-content / carré) × (original / N&B / monochrome / monochrome clair / couleurs custom), les exporte (PNG/JPG/SVG/AI/PDF), et peut produire une **présentation InDesign `.idml`** avec des **mockups Photoshop** rendus via BridgeTalk.

- **Auteur unique** : Pupille Studio (`pupille.agence@gmail.com`)
- **Repo** : `github.com/pupilleagence-source/logo-declinaisons` (privé) — 32 commits sur `master`, oct. 2025 → juin 2026
- **Releases** : publiées dans un **repo séparé public** `pupilleagence-source/logo-declinaisons-releases`
- **Backend** : Vercel, projet `logotyps` → `https://logotyps.vercel.app` (12 endpoints, Redis Cloud)
- **Stack** : zéro framework, zéro build step, zéro test, zéro lint. HTML/CSS/JS vanilla + ExtendScript ES3.
- **Langue** : tout ce qui est visible et tous les commentaires sont en **français**, les identifiants sont en anglais.
- **~13 450 lignes** de code applicatif réparties sur 4 sous-systèmes.

---

## 2. ⚠️ À LIRE AVANT DE TOUCHER QUOI QUE CE SOIT

### 2.1 Le repo git **EST** le plugin installé

`pwd` = `%APPDATA%\Adobe\CEP\extensions\logo-declinaisons`. Ce dossier est à la fois le dépôt git **et** l'extension chargée par Illustrator.

- `git checkout autre-branche`, `git stash`, `git reset --hard`, `git clean` **hot-swappent le panneau sous un Illustrator en cours d'exécution**.
- Illustrator **met le panneau en cache** : après une modif de `js/` ou `jsx/`, il faut **fermer et rouvrir le panneau** (voire relancer Illustrator) pour la voir. Sinon on conclut « mon fix ne marche pas » et on va casser autre chose.
- `js/auto-updater.js` écrit `.temp_update/` et des `.bak` dans ce même arbre au runtime.

### 2.2 Deux copies du front-end, toutes les deux « live »

| Copie | Rôle |
|---|---|
| `js/`, `index.html`, `css/`, `jsx/`, `CSXS/` (racine) | Ce que les utilisateurs exécutent, ce que les installeurs embarquent |
| `backend-trial/distribution/**` (12 fichiers) | Ce que le serveur d'update sert (`backend-trial/api/updates/files.js:47` résout `process.cwd()/distribution`) |

**État actuel vérifié** : `distribution/` est en retard d'**exactement le commit `4a3a577`**. 4 fichiers sur 12 diffèrent : `index.html` (4 lignes), `css/styles.css` (22), `js/main.js` (71), `jsx/hostscript.jsx` (15). Les 8 autres sont byte-identiques. Rien dans `distribution/` n'existe qui manque à la racine.

Concrètement : `distribution/jsx/hostscript.jsx` n'a **pas** `clearStoredSelection(type)` (racine `:533`), alors que `js/main.js:1123` l'appelle → le bouton ✕ par slot planterait.

> **Mais** : voir §2.3 — ça ne peut pas atteindre les utilisateurs aujourd'hui.

### 2.3 L'auto-updater in-place est du **code mort** — ne pas synchroniser `distribution/` sans décision

`UpdateChecker.installUpdate()` (`js/updater.js:127`) et `downloadUpdate()` (`:218`) ont **zéro appelant** dans tout le repo. Le vrai handler de `#update-download-btn` est `js/main.js:768-779`, commenté `// Ouvrir le lien de download dans le navigateur (pas d'auto-écrasement)` : il ouvre juste la page GitHub Releases.

Donc `AutoUpdater.performUpdate` ne tourne jamais. Les warnings sur la staleness de `distribution/`, sur les checksums et sur le CRLF sont **latents, pas actifs**.

**Le vrai danger** : « réparer » le bouton pour appeler `installUpdate()` est un changement d'une ligne qui **livrerait instantanément un downgrade à tous les utilisateurs**. Décider d'abord si la fonctionnalité revient.

État vérifié par curl sur la prod : `/api/version/latest` → 200 `{"version":"1.1.0",...}` ; `/api/updates/files?file=js/main.js` → 200, 83 790 octets, byte-identique à `distribution/js/main.js`. Les **12 checksums de `manifest.js:43-54` matchent** le disque et le serveur. Le registre est cohérent — il sert juste du code en retard.

### 2.4 Huit chaînes de version, aucune synchronisée

| Fichier | Ligne | Valeur | Qui la lit |
|---|---|---|---|
| `CSXS/manifest.xml` | 2 et 4 | 1.1.0 ✅ *aligné 2026-09-04* | **Illustrator** (la seule qui compte pour le chargement) |
| `package.json` | 3, 16, 22 | 1.1.0 ✅ *aligné 2026-09-04* | rien |
| `installer.iss` | 6 (fallback) | **1.0.0** | `iscc` sans `/DMyAppVersion` |
| `js/updater.js` | 7 (`CURRENT_VERSION`) | 1.1.0 | la comparaison de version côté client |
| `backend-trial/api/version/latest.js` | 34 | 1.1.0 | le client |
| `backend-trial/api/updates/manifest.js` | 34 | 1.1.0 | l'updater |
| `installers/mac/build-pkg.sh` | 10 (fallback) | 1.1.0 | build local |
| `.github/workflows/build-installers.yml` | input default | 1.1.0 | CI |

Rien ne dérive de rien. `iscc installer.iss` en local produit silencieusement un installeur estampillé **1.0.0** contenant du code 1.1.0.

### 2.5 Secrets committés dans git

1. **`backend-trial/test-lemon.js:5`** — une clé API **Lemon Squeezy** (JWT de 1034 caractères, `exp` en 2035), fichier **tracké**.
   ✅ *2026-09-04 : le fichier lit maintenant `process.env.LEMONSQUEEZY_API_KEY`.*
   ⚠️ **La clé reste dans l'historique git et est toujours valide.** Le correctif ne fait qu'arrêter l'hémorragie. **Action utilisateur obligatoire : révoquer et régénérer la clé dans le dashboard Lemon Squeezy.** Une réécriture d'historique (`git filter-repo` + force-push) est un second chantier, à décider séparément.
2. **`certificate.p12`** — certificat de signature ZXP **tracké**, malgré `.gitignore:35` (`*.p12` ajouté *après* le commit ; gitignore ne détrack jamais). Mot de passe en clair `logodeclinaisons2024` dans 4 fichiers trackés : `build-zxp.js:13`, `create-zxp.bat:10`, `create-zxp-clean.bat:10`, `create-zxp-simple.bat:11`.

**Jamais entrés dans git** (vérifié `git log --all --`) : `backend-trial/.env.local`, `backend-trial/.vercel/`, `apple-cert/`. Ces trois n'existent **que sur cette machine** — `apple-cert/` contient les seules copies des certificats Apple (perte = régénération complète).

### 2.6 La branche `backup-v1.0.2-full` n'existe que sur ce disque

`git ls-remote --heads origin` ne renvoie que `refs/heads/master`. La branche locale contient **11 commits absents de master** (`f56436b`, `7b2554f`, `42f4eb5`, `9957ebe`, `74965c9`, `8fa16f3`, `2baeb40`, `4f3b115`, `be987d3`, `da72074`, `6ba2cf7`).

Le 2026-04-17, un `git reset --hard 40c402c` a jeté ces 11 commits, puis `f6b915c` les a re-landés en **un seul commit de 19 381 insertions**. Conséquence : `git blame` sur `js/idml-generator.js`, `js/i18n.js`, `js/hwid.js` etc. pointe sur `f6b915c` et n'explique rien. Le vrai historique (générateur IDML, pages d'interdits, mockups Photoshop, i18n, contournements du tier Hobby de Vercel) est **uniquement** sur cette branche non poussée.

✅ *2026-09-04 : la branche a été poussée sur `origin`.* L'historique granulaire est donc sauvegardé — mais `git blame` sur `master` reste inutile pour ces fichiers : passer par `git log backup-v1.0.2-full -- <fichier>` pour comprendre le pourquoi d'un choix.

### 2.7 La doc de release envoie sur les mauvais fichiers

✅ *2026-09-04 : `installer-windows.iss` (le doublon mort, AppId différent, sans templates) a été **supprimé**, les deux références de `GUIDE-DISTRIBUTION.md` corrigées, et un bandeau d'avertissement daté ajouté en tête de `GUIDE-DISTRIBUTION.md`, `GUIDE-MISE-A-JOUR.md`, `GUIDE-MISE-A-JOUR-AUTO.md`, `INSTRUCTIONS-ZXP.txt`, `backend-trial/README.md` et `backend-trial/GUIDE-DEPLOIEMENT.md`.*

Ces six fichiers restent **périmés sur le fond** — le bandeau prévient, il ne corrige pas. Erreurs de fond connues :
- `GUIDE-MISE-A-JOUR-AUTO.md:24-25` et `:161` disent `cp js/main.js backend-trial/distribution/main.js` (chemin **plat**). La vraie arborescence est **imbriquée** : `distribution/js/main.js`. Le guide référence aussi `distribution/README.md` (`:314`) qui n'existe pas.
- `backend-trial/README.md` et `GUIDE-DEPLOIEMENT.md` décrivent un backend à 2 endpoints sur Vercel KV nommé `logo-declinaisons-trial` : en réalité 12 endpoints, projet `logotyps`, datastore **Redis Cloud**.

**Les seuls guides fiables : ce fichier et `GUIDE-TEMPLATES-INDESIGN.md`** (à quelques écarts près, voir §7.3).

### 2.8 URL de production en dur dans 11 endroits

`https://logotyps.vercel.app` est codé en dur dans `js/trial.js` (`:11, :65, :257, :426, :649`), `js/main.js` (`:899, :981`), `js/updater.js` (`:10, :13`), `js/auto-updater.js` (`:7`) et `backend-trial/api/updates/manifest.js:32`. **Aucun switch d'environnement, aucune URL de staging.** Si le domaine Vercel change, tous les clients installés sont définitivement cassés — y compris l'updater qui aurait pu les réparer.

### 2.9 Pas de tests, pas de lint, pas de validation CI

Aucun `*.test.js`, aucun `.eslintrc`, aucun `tsconfig`, aucun `.prettierrc`, aucun `.gitattributes`. `backend-trial/test-lemon.js` est un script curl jetable, pas un test. La CI (3 jobs) ne fait que compiler des installeurs. `npm run build` / `build:win` / `build:mac` sont **cassés** (`cep-packager` n'est ni déclaré ni installé) ; seul `npm run build:zxp` fonctionne.

---

## 3. Architecture — les 4 sous-systèmes

```
┌─ PANNEAU CEP (CEF + Node) ─────────────────────────────────────┐
│  index.html (444 l.) ── 3 onglets + barre d'action + 2 modales  │
│  css/styles.css (1667 l.) ── design system "DA Logotyps"        │
│                                                                 │
│  js/main.js (2105 l.)  ← LE contrôleur, appState, tous les      │
│                          bindings, tous les evalScript          │
│  js/i18n.js (764 l.)   ← fr/en/es/it, 148 clés (73 mortes)      │
│  js/trial.js (683 l.)  ← machine à états trial/licence          │
│  js/hwid.js (213 l.)   ← empreinte machine HWID-<sha256>        │
│  js/updater.js (254 l.) + js/auto-updater.js (388 l.)  [DORMANT]│
│  js/debug-mode-enabler.js (182 l.) ← modale macOS PlayerDebug   │
│  js/idml-generator.js (1981 l.) ← chirurgie XML sur .idml       │
│  lib/CSInterface.js (vendored) + lib/jszip.min.js (3.10.1)      │
└────────────────────┬────────────────────────────────────────────┘
                     │ csInterface.evalScript("fn(json)")
┌────────────────────▼────────────────────────────────────────────┐
│  jsx/hostscript.jsx (3479 l., ES3) ── LE plus gros fichier      │
│  47 fonctions top-level, ~14 réellement appelées                │
│  DOM Illustrator + génération de code Photoshop/InDesign        │
└──────────┬──────────────────────────────────────┬───────────────┘
           │ BridgeTalk                           │ BridgeTalk
     ┌─────▼──────┐                        ┌──────▼──────┐
     │ Photoshop  │ ──── BridgeTalk ─────▶ │  InDesign   │
     │ 9 mockups  │                        │ .idml final │
     └────────────┘                        └─────────────┘

┌─ BACKEND (Vercel serverless, ESM, sans framework) ─────────────┐
│  backend-trial/api/  12 endpoints  →  Redis Cloud (eu-west-3)  │
│  trial/{check,increment,reset}  license/{activate,validate,     │
│  deactivate,force-deactivate}  updates/{manifest,files}         │
│  version/latest  webhooks/lemonsqueezy  keepalive               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Le contrat JS ↔ ExtendScript (essentiel)

Tout passe par **`evalExtendScript(fnName, params, timeout)`** — `js/main.js:1884`. Elle construit `fn(JSON.stringify(p1), ...)`, wrappe `csInterface.evalScript` dans une Promise, rejette sur `'EvalScript error.'` ou sur timeout.

**Timeouts explicites** : 30 s par défaut · **120 s** pour `generateArtboards` (`:1309`) et le color picker (`:1933`) · **300 s** pour l'export (`:1362`) · **0** (aucun) pour le folder picker (`:2092`).

**5 appels contournent le wrapper** et concatènent la string à la main : `main.js:1123, 1574, 1590, 1607, 1637` (+ le script de polices inline `:1773`).

### Le retour JSX → JS mélange **trois** conventions

1. **Sentinelles préfixées** (parsées par `startsWith`/`split`) : `"OK"`, `"NO_DOCUMENT"`, `"NO_SELECTION"`, `"SELECTION_OK"`, `"CANCELLED"`, `"SUCCESS:<n>"`, `"ERROR: <message fr>"`, `"COLOR:#RRGGBB"`, `"COLORS:<json>"`
2. **JSON.stringify** — uniquement pour la famille BridgeTalk/debug
3. **Valeurs brutes** : `hasOpenDocument` renvoie la **string** `"true"`/`"false"` ; `selectExportFolder` un `fsName` nu ou `""` ; `getInstalledFonts` des familles jointes par `|`

⚠️ Le préfixe `"ERROR: "` fait 7 caractères mais est strippé avec `substring(6)` en `main.js:1315` et `substring(7)` en `:1104`/`:2008` → certains messages arrivent avec une espace parasite.

### Règle absolue : les chemins traversant la frontière sont normalisés en slashes avant

`.replace(/\\/g, '/')` — `main.js:1479, 1483, 1537, 1558-1562`. Contournement délibéré de l'échappement des antislashs Windows dans les strings concaténées.

---

## 5. Flux principaux

### 5.1 Sélection
`.btn-select[data-type]` → `handleSelection` (`main.js:1054`) → `hasOpenDocument()` → `getSelectionInfo()` → `storeSelection(type)` (`hostscript.jsx:468`).

`storeSelection` **duplique** la sélection, la **masque**, et garde la **référence PageItem vivante** dans le global `storedSelections` (`hostscript.jsx:6`, 7 slots). Cet état persiste entre les `evalScript` — c'est ce qui fait marcher le panneau, et c'est la source de la fragilité : si l'utilisateur ferme/change de document ou fait undo, les références deviennent obsolètes et `generateArtboards` échoue en `:1485`.

### 5.2 Générer
`#generate-btn` → `handleGenerate` (`main.js:1285`) → `checkTrialAllowed()` → `generateArtboards(json)` avec exports **explicitement mis à zéro** (`:1300-1305`), timeout 120 s → `"SUCCESS:<n>"` → `Trial.incrementGeneration()`.

### 5.3 Exporter
`#export-btn` → `handleExport` (`main.js:1337`) → même appel avec les vrais paramètres d'export, timeout 300 s → puis éventuellement `handleGeneratePresentation()` → `showExportDonePopup()`.

**Arborescence écrite sur disque** :
```
<outputFolder>/<type>/<colorVariation>/<FORMAT>/<prefix><artboardName>.<ext>
```
`type` ∈ {horizontal, vertical, icon, text, custom1..3, favicon} · `colorVariation` ∈ {original, blackwhite, monochrome, monochromeLight, custom} · `prefix` ∈ {petit_, moyen_, grand_, custom_WxH_}

### 5.4 Présentation InDesign (BÊTA)
`handleGeneratePresentation` (`main.js:1406`) — **uniquement atteignable depuis `handleExport:1380`**, et dépend de fichiers déjà écrits sur disque.

1. Si aucun mapping couleur n'existe, re-dérive les couleurs de marque en **regexant les SVG déjà exportés** (`<outputFolder>/<type>/original/SVG/*.svg`) — donc si SVG n'était pas dans les formats cochés, la palette est vide.
2. `IDMLGenerator.generate(config)` — dézippe `templates/template-1.idml`, patche le XML à la regex, rezippe vers `<outputFolder>/presentation-logo.idml`.
3. `processPhotoshopThenInDesign(idmlPath, mockupDataJson)` (`hostscript.jsx:2795`) — **génère un script Photoshop sous forme de string géante**, l'écrit dans `<outputFolder>/_temp/mockups-ps-script.jsx`, envoie un BridgeTalk `$.evalFile(...)`.
4. Photoshop traite les 9 PSD puis, **à la fin de son propre script**, envoie lui-même un BridgeTalk à InDesign (`hostscript.jsx:3193-3198`). Le commentaire `:3191-3192` explique pourquoi : les callbacks `onResult` de BridgeTalk ne se déclenchent jamais depuis Illustrator (le contexte appelant est déjà terminé).
5. InDesign ouvre l'IDML, `fit()` les cadres `MOCKUP_*`, redimensionne les images `PROHIB_*` à 75 %, puis **supprime tout `_temp/`**.

**BridgeTalk est fire-and-forget** : `processPhotoshopThenInDesign` renvoie `{"success":true,"status":"processing"}` dès l'envoi. Le panneau n'apprend **jamais** si les mockups ont réussi.

---

## 6. Trial & licence

### Côté client (`js/trial.js`, `js/hwid.js`)

- **HWID** = `HWID-<sha256>` de `['v2', hostname, username, MAC, osType, osArch, cpuModel, cpuCores]`. Priorité **disque > localStorage > génération** : `~/.logotyps-hwid`, puis `localStorage._hwid`.
- **Licence** : `localStorage._license` (en `btoa`, **pas** du chiffrement) **+** `~/.logotyps-license` (JSON en clair). Le tier disque existe parce qu'une mise à jour d'Illustrator efface la partition localStorage de CEP.
- **Trial** : 7 générations, **comptées côté serveur uniquement**. Aucun fallback hors-ligne → le trial **échoue fermé** sans réseau.
- **Licence hors-ligne** : **échoue ouvert** pendant 7 jours de grâce, mesurés depuis `activatedAt` (pas depuis la dernière validation réussie).
- **Deux chemins de décision indépendants et non partagés** : `getStatus()` (`:40`, peint le badge, avec cache) et `canGenerate()` (`:245`, la vraie porte, **sans cache**, revalide à chaque clic).

### Côté serveur

Le backend est un **proxy fin devant Lemon Squeezy** + cache Redis. Clés : `trial:<hwid>` (compteur, **sans TTL**), `license:<hwid>` (blob JSON, **sans TTL**), `_keepalive`.

**Un achat ne passe jamais par le webhook** : `order_created` / `license_key_created` ne sont pas gérés. Une licence ne devient active que quand l'utilisateur colle sa clé dans le panneau. Le webhook est **uniquement un canal de révocation** (`order_refunded`, `subscription_cancelled/expired`, `license_key_updated`).

### ⚠️ Le trial est de la friction, pas du DRM

- `~/.logotyps-license` est du JSON en clair : écrire `{"active":true,"key":"x","activatedAt":<now>}` + bloquer `logotyps.vercel.app` = 7 jours illimités.
- `/api/trial/reset` est **routé publiquement sans auth** malgré son en-tête « DÉVELOPPEMENT SEULEMENT » (`api/trial/reset.js:3`).
- `/api/trial/increment` fait un GET→+1→SET **non atomique**.
- Points d'entrée **non gatés du tout** : `generateHorizontalLayout` (`main.js:526`), `generateVerticalLayout` (`:561`), `analyzeColors` (`:1970`), `handleGeneratePresentation` (`:1406`), `handleRerunMockups` (`:1629`).
- **Race au double-clic** : `checkTrialAllowed()` est `await`é (`main.js:1289`) *avant* que le bouton soit désactivé (`:1291`). Pendant les ~5 s de round-trip réseau, deux clics passent tous les deux → une génération gratuite **et** deux `generateArtboards` concurrents dans un moteur ExtendScript mono-thread. *Fix : désactiver le bouton en première instruction.*

---

## 7. Assets & templates

### 7.1 Les chiffres
- **9 PSD mockups** dans `templates/mockups/` : app, book, card, enseigne, porte-cle, tampon, tote-bag, tshirt, vitre — **397 MiB** au total (le plus gros : `enseigne.psd`, 65 MB).
- **2 IDML** : `template-1.idml` (219 KB, **le seul utilisable**) et `template-2.idml` (7,3 MB).

### 7.2 Les contrats de nommage (c'est l'API)

**Dans les PSD** (lus par le script Photoshop généré) :
- Smart Objects dont le **contenu interne** porte des calques nommés `LOGO`, `LOGO_HORIZONTAL`, `LOGO_VERTICAL`, `LOGO_ICON`, `LOGO_TEXT`, `LOGO_CUSTOM1..3`
  ⚠️ Nommer le Smart Object lui-même `LOGO_ICON` **ne suffit pas** — le code ignore le nom du SO et inspecte uniquement le document *à l'intérieur* (`hostscript.jsx:3058-3068`).
- Calques Solid Fill : `COLOR`, `COLOR_1..COLOR_5`, `COLOR_DARK`, `COLOR_LIGHT`
- Calques texte contenant `{{BRAND_NAME}}`

**Dans l'IDML** (noms du panneau Calques InDesign, SCREAMING_SNAKE_CASE) :
| Préfixe | Effet |
|---|---|
| `LOGO_{TYPE}_{COLOR}` | remplir avec une image |
| `BLOCK_*` | supprimer le groupe si la donnée est absente |
| `PAGE_*` | supprimer toute la planche |
| `ZONE_*` | zone de protection (marges d'exclusion) |
| `PROHIB_*` | exemples d'usages interdits |
| `MOCKUP_*` | rendu Photoshop |
| Nuanciers | `BRAND_COLOR_N`, `BRAND_CUSTOM_N`, `BRAND_MONO_DARK`, `BRAND_MONO_LIGHT` |
| Styles | `BRAND_PRIMARY`, `BRAND_SECONDARY` |
| Texte | `{{TOKEN}}` |

**Ajouter un mockup** = déposer le PSD dans `templates/mockups/`, nommer ses calques, ajouter un rectangle `MOCKUP_<BASENAME>` dans l'IDML. **Aucun code à modifier.**

**Deux dialectes coexistent** pour `LOGO_` et `ZONE_` : avec accolades (`LOGO_{HORIZONTAL}_{ORIGINAL}`, ce qu'utilisent réellement les templates) et sans (ce que montre le guide). Leurs regex acceptent `\{?…\}?`. Les regex `PROHIB_` et `MOCKUP_` **n'acceptent pas les accolades** → no-op silencieux.

### 7.3 Écarts documentés vs réel dans `GUIDE-TEMPLATES-INDESIGN.md`
- Le guide dit « si le logo n'existe pas, le frame entier sera supprimé ». **Faux** : `idml-generator.js:1633-1635` garde le cadre vide. Seuls `BLOCK_LOGO_*`, `PROHIB_` et `MOCKUP_` sont réellement supprimés.
- `BLOCK_CUSTOM_INLINE_N` existe dans le code et dans template-1 mais **zéro fois** dans le guide.
- Le guide ne mentionne pas l'exigence d'**imbrication** des calques `LOGO_*` dans les Smart Objects.

### 7.4 template-2.idml : à supprimer
Inaccessible depuis l'UI (`index.html:274-284` n'offre que `template-1` et un radio `custom` désactivé), aucun cadre `MOCKUP_`, seulement 3 des 34 placeholders — **et 16 `LinkResourceURI` absolus pointant vers un projet client privé** `C:/Pupille/Projets/hebi%20tatoo/*`. Pourtant `installer.iss:63` le livre. 7,3 MB + fuite de confidentialité pour rien.

### 7.5 Chaque génération écrit ~400 MB chez l'utilisateur
`hostscript.jsx:3171-3175` sauvegarde chaque mockup traité en **PSD complet avec calques** dans `<outputFolder>/mockups/`, en plus du PNG. Rien ne les relit jamais. Le nettoyage de `_temp/` n'y touche pas.

---

## 8. Build & release — la procédure réelle

### Le seul chemin supporté

```
workflow_dispatch sur .github/workflows/build-installers.yml
  inputs : version (string) + publish (bool)
  ↓
  build-mac (macos-latest)   : import des 2 certs Apple → installers/mac/build-pkg.sh
  build-windows (windows-lt) : choco install innosetup → iscc /DMyAppVersion=<v> installer.iss
  ↓
  publish-release (ubuntu)   : gh release delete v<v> --cleanup-tag || true
                               gh release create v<v> --repo …/logo-declinaisons-releases
```

**Il n'y a aucun trigger sur push ou tag.** Ce repo a **zéro tag git** — ils sont créés dans le repo de releases séparé. Aucun lien entre un binaire livré et un SHA de commit.

⚠️ **Re-lancer une version déjà publiée détruit la release existante et son tag** (`build-installers.yml:109`).

### Checklist de bump de version (8 endroits, tous à la main)

1. `CSXS/manifest.xml` lignes 2 **et** 4 ← *la seule que lit Illustrator, jamais bumpée depuis 1.0.0*
2. `package.json` lignes 3, 19, 25
3. `js/updater.js:7` (`CURRENT_VERSION`)
4. `backend-trial/api/version/latest.js:34` (+ `releaseDate` `:35` + changelog)
5. `backend-trial/api/updates/manifest.js:34` (+ checksums si OTA réactivé)
6. `installer.iss:6` (fallback seulement)
7. `installers/mac/build-pkg.sh:10` (fallback seulement)
8. Input du workflow au déclenchement

Puis `cd backend-trial && vercel --prod` pour le backend.

### Le truc du binaire stub macOS (commit `955b47c`)

Apple refuse de notariser un `.pkg` ne contenant que du contenu statique (« Package has no signed executables or bundles »). `build-pkg.sh:51-78` compile un **fichier C de 6 lignes** en Mach-O universel (arm64 + x86_64) vers `<payload>/bin/logo-declinaisons-helper`, le `codesign` avec hardened runtime + timestamp.

**Ce binaire inerte est livré sur chaque Mac. Ne jamais le « nettoyer » — c'est toute sa raison d'être.**

Le contournement du commit `96ff1d9` (grep du log de notarisation) a été **entièrement annulé** par `955b47c`. `build-pkg.sh:189-200` fait maintenant `exit 1` sur tout statut ≠ `Accepted`. Ne pas perdre de temps à le chercher.

### Échecs silencieux à surveiller
- `installer.iss:62-64` utilise `skipifsourcedoesntexist` sur les 3 lignes de templates ; `build-pkg.sh:44,46` utilise `2>/dev/null || true`. Un checkout sans `templates/` produit un build **vert** livrant un installeur sans présentation ni mockups, **sans aucun avertissement**.
- Si `APPLE_DEVELOPER_ID_APPLICATION` manque, `build-pkg.sh:77` n'affiche qu'un WARNING et continue ; le build échoue bien plus tard à la notarisation avec une erreur Apple incompréhensible. **C'est le premier secret à vérifier quand un build Mac casse.**

### Portées d'installation différentes selon la plateforme
- **Windows** (`installer.iss:28`) : par utilisateur, `%APPDATA%\Adobe\CEP\extensions\logo-declinaisons`
- **macOS** (`build-pkg.sh:11`) : **système entier**, `/Library/Application Support/Adobe/CEP/extensions/…` (root, mot de passe admin)
- Le `.exe` **n'est jamais signé** → SmartScreen chez tous les utilisateurs Windows.

### PlayerDebugMode — couverture incohérente
L'extension n'est pas signée par Adobe : CEP refuse de la charger sans `PlayerDebugMode=1`.

| Endroit | Versions CSXS couvertes |
|---|---|
| `installer.iss:68-71` (HKCU) | **9–12** |
| `installers/mac/build-pkg.sh:98` | 9–14 |
| `install.bat:33-35` (non tracké) | **9–11** |
| `install-mac.command`, `enable-cep-debug*.reg/.command` | 9–12 |

Illustrator 2024 = CSXS 13, 2026+ = CSXS 14. **Sur Windows, Illustrator 2024+ n'aura pas le flag** alors que `CSXS/manifest.xml:9` déclare supporter `[26.0,99.9]`.

### Le canal ZXP est mort (mais pas nettoyé)
4 scripts de build (`build-zxp.js`, `create-zxp{,-clean,-simple}.bat`), `ZXPSignCmd.exe` (3,8 MB commité), `certificate.p12`, `INSTRUCTIONS-ZXP.txt` — rien n'est utilisé par la CI. `build-zxp.js:68` et `create-zxp.bat:36` signent **le répertoire entier** (`__dirname` / `.`) → embarqueraient `node_modules`, `dist/`, `certificate.p12` et `apple-cert/`. Les variantes `-clean`/`-simple` stagent une whitelist, mais **excluent `templates/`** → un ZXP sans mockups ni IDML.

---

## 9. Conventions de code

- **Français** pour tout ce qui est visible et pour les commentaires ; **anglais** pour les identifiants. Nouveaux messages → en français, avec un remède concret (`'Déverrouillez-le dans le panneau Calques'`).
- **`jsx/` est en ES3 strict** : `var` uniquement, pas de `let`/`const`, pas d'arrow functions, pas de `Array.map/forEach/filter`, boucles `for` avec index manuel. Regex et `try/catch` sont OK.
- **`js/` est un dialecte mixte** : le code original est ES6 (`const`/`let`, arrow, `async/await`, template literals), les blocs ajoutés plus tard sont ES5. Les deux sont acceptés.
- **Jamais d'`alert()` depuis le host** — `hostscript.jsx:914` documente le remplacement d'un `alert()` par `$.writeln` parce que les alertes **bloquent le panneau CEP**. (Les scripts standalone `fit-image-in-frame.jsx` et `optimize-mockups.jsx` peuvent alerter : ils sont lancés depuis le menu Scripts.)
- **Logs à préfixe emoji**, utilisés partout de façon cohérente : 🚀 démarrage · 📄/📦 phase · ✓/✅ succès · ⚠️ warning · ❌ erreur · 🧹 nettoyage · 🎨 couleur · 🌐 favicon · 💾 sauvegarde · 🔍 debug. **Grepper un emoji est souvent le moyen le plus rapide de trouver un chemin de code.**
- **`appState` est l'unique source de vérité** (`main.js:9-65`). Pattern : listener lit le contrôle DOM → écrit `appState` → appelle `updateUI()`. Ne jamais relire l'état d'un contrôle ailleurs.
- **Un seul point de recalcul** : `updateUI()` (`main.js:1190`).
- **Tout le wiring statique est au même endroit** : `setupEventListeners()` (`main.js:325`, ~420 lignes). Commencer là pour trouver ce que fait un contrôle.
- **Helpers de validation** : renvoient `{valid: boolean, error: '<français>'}`.
- **Show/hide** : toujours `element.style.display = 'block'|'none'` depuis JS, amorcé par un `style="display: none;"` inline. **Aucune classe `.hidden`.**
- **Les 7 types de sélection** `['horizontal','vertical','icon','text','custom1','custom2','custom3']` sont **dupliqués littéralement dans au moins 9 endroits** : `main.js:1418, 1508, 1661` · `hostscript.jsx:619, 1455, 1569, 1628, 2852` · `idml-generator.js:421`. Ajouter un type = éditer les 9.
- **Conventions d'ID DOM** : `status-<type>`, `label-<type>`, `variation-<type>`, `.btn-select[data-type]`, `.btn-clear-selection[data-type]`, `tab-<name>` + `.tab-button[data-tab=<name>]`.
- **Backend** : chaque endpoint est `export default async function handler(req, res)` en ESM. Préambule identique partout : 4 `res.setHeader` CORS → court-circuit `OPTIONS` → garde de méthode (405) → `try/catch` (500). Le helper Redis `getRedisClient` est **copié-collé à l'identique dans 8 fichiers**.
- **Coordonnées** : les `bounds` Illustrator sont `[left, top, right, bottom]` avec Y croissant vers le haut (`width = b[2]-b[0]`, `height = b[1]-b[3]`). Les `geometricBounds` InDesign sont `[y1, x1, y2, x2]`. **Les deux conventions apparaissent dans `hostscript.jsx` — vérifier dans quel host on est.**

---

## 10. Bugs connus, vérifiés, non corrigés

Classés par impact utilisateur. Les lignes marquées ✅ ont été corrigées le 2026-09-04
(validées syntaxiquement et logiquement, **pas encore testées dans Illustrator**).
Toutes les autres sont toujours présentes dans le code.

| # | Bug | Localisation |
|---|---|---|
| 1 | **Tous les exports font 60 % de la taille annoncée.** L'UI propose « Petit (1000 px) / Moyen (2000) / Grand (4000) » mais le plan de travail fait **600 points** en dur et l'échelle d'export est `(exportSize/1000)*100`. → 1000 donne 600 px, 2000 → 1200, 4000 → 2400. Seuls les favicons sont corrects (32 pt, `exportSize` forcé à 1000). | `hostscript.jsx:1565`, `:2318, :2326, :2635, :2643` ; libellés `index.html:223/227/231` |
| 2 | **La taille custom W×H est silencieusement ignorée.** Elle est réduite à `Math.max(width,height)` et passée dans la même formule. Le préfixe de nom de fichier `custom_1920x1080_` ment. | `hostscript.jsx:1862-1872` vs `:2620` |
| 3 | ✅ **CORRIGÉ 2026-09-04.** **Le compteur de plans de travail est gonflé ~×3 et la garde « au moins une couleur » est morte.** `Object.values(appState.colorVariations).filter(v => v).length` compte les deux propriétés **string** `monochromeColor:'#000000'` et `monochromeLightColor:'#ffffff'` (truthy). Avec seulement « original » coché, `colorCount` vaut 3. Comme il ne peut jamais descendre sous 2, le test `colorCount > 0` qui active les boutons est un no-op. | `main.js:1212` (état déclaré `:32, :34`) ; gardes `:1258, :1265` |
| 4 | **Le webhook Lemon Squeezy est totalement non authentifié.** La vérification HMAC est écrite mais désactivée (commentaire sur le body parser de Vercel) ; `verifyWebhookSignature` n'est jamais appelée. Quiconque connaît l'URL peut POSTer un faux `order_refunded` et supprimer l'activation d'un client payant. Fix : `export const config = { api: { bodyParser: false } }` + parsing manuel du raw body. | `webhooks/lemonsqueezy.js:34, :49-57` |
| 5 | **`LEMONSQUEEZY_API_KEY` est utilisée dans 4 endroits mais absente de `.env.local`.** Si elle n'est pas non plus dans le dashboard Vercel, toutes les libérations de slot partent en `Bearer undefined` et échouent en silence (le code ne fait qu'un `console.warn` puis supprime quand même de Redis) → slots Lemon Squeezy orphelins à vie, jusqu'à ce que le client atteigne la limite d'activation. **Vérifier le dashboard Vercel avant de toucher au code de licence.** | `force-deactivate.js:75` ; `webhooks/lemonsqueezy.js:105, :164, :215` |
| 6 | **Fuite de slot suspectée à l'activation.** `activate.js:67-70` POSTe `{license_key, instance_name}` vers l'endpoint **validate** de LS — or LS validate attend `instance_id` et sa réponse ne contient pas de champ `activated`. La branche `if (!lemonData.activated)` est donc toujours vraie → **chaque appel crée une nouvelle instance LS et consomme un slot.** À tester en premier si des clients signalent « limite d'activation atteinte ». | `activate.js:88` ; même paramètre erroné en `validate.js:77` |
| 7 | ✅ **CORRIGÉ 2026-09-04** (les deux moitiés : `getStatus()` purge maintenant le disque, et `canGenerate()` purge puis retombe sur le trial au lieu de bloquer en dur). **Le fix de la « licence fantôme » n'est fait qu'à moitié.** Le commit `7625954` a corrigé `getStatus()` pour purger une licence périmée, mais il ne supprime que les clés **localStorage** — jamais `_removeLicenseFromDisk()`. Comme `getStoredLicense()` retombe sur `~/.logotyps-license` et **réhydrate localStorage depuis le disque**, la licence ressuscite à l'appel suivant. Pire : `canGenerate()` a sa propre copie du test de grâce qui bloque en dur (`reason:'license_offline'`) sans rien purger → le badge repasse en trial mais la génération reste bloquée. **C'est exactement le symptôme que le commit prétendait corriger.** | `trial.js:143-162` (comparer avec la branche de révocation correcte `:118-120`) ; `trial.js:321-328` |
| 8 | ✅ **CORRIGÉ 2026-09-04.** **La désactivation normale laisse le fichier disque.** `main.js:1021` ne fait que `localStorage.removeItem('_license')` → le panneau continue d'afficher « ✓ Licensed ». Le chemin `forceLicenseDeactivate()` est correct (`trial.js:641-642`). | `main.js:1021` |
| 9 | **`cacheStatus()` jette silencieusement l'`expiry` reçu.** Les deux appelants passent `Date.now() + 24h` avec un commentaire `// 24h` ; la fonction reconstruit l'objet avec **7 jours**. Après une validation réussie, `getStatus()` renvoie « licensed » depuis le cache sans réseau pendant une semaine. | `trial.js:476-488` (appels `:84`, `:105`) |
| 10 | ✅ **CORRIGÉ 2026-09-04.** **Le rollback de l'auto-updater ne peut jamais s'exécuter.** Le champ est déclaré `filesFailedé: []` (accent parasite) mais on pousse dans `results.filesFailed` → `TypeError` sur le premier échec, donc `rollbackAll()` est sauté. Dossier à moitié mis à jour, jonché de `.backup` orphelins. **À corriger impérativement avant de réactiver `installUpdate`.** | `auto-updater.js:264` vs `:322`, rollback `:325-327` |
| 11 | ✅ **CORRIGÉ 2026-09-04** — l'`@import` est maintenant en ligne 1, donc **la typo du panneau change visuellement** (Inter au lieu des polices système). Revert = redéplacer la ligne. **L'`@import` Google Fonts est mort.** Il est placé **après** le bloc de reset `*{}` (lignes 2-6) ; par spec, `@import` doit précéder toute autre règle → le parseur le jette. Tout le panneau rend en polices système. Le déplacer en ligne 1 changera visiblement toute la typo (mieux : auto-héberger, un panneau CEP peut être hors-ligne). | `css/styles.css:8` |
| 12 | ✅ **CORRIGÉ 2026-09-04** (helper `syncRangeFill` générique sur tous les `input[type=range]`). **Les 3 sliders affichent toujours un remplissage à 0 %.** Le dégradé utilise `var(--value, 0%)` et **rien ne définit jamais `--value`** (zéro `setProperty` dans `js/`). | `css/styles.css:468` |
| 13 | **Le texte de statut de sélection ment après un changement de langue.** Les spans portent `data-i18n="sel_not_selected"` ; `handleSelection` y écrit « Sélectionné ✓ » en dur sans retirer l'attribut → le `applyToDOM()` suivant les réécrit en « Not selected » alors que `appState.selections` est toujours vrai et que le texte reste vert. | `main.js:1091` + `i18n.js:741` |
| 14 | **IDs dupliqués sur les variations custom.** `addCustomVariation` incrémente un compteur, mais `removeCustomVariation` le recalcule depuis `container.children.length`. Ajouter custom1/2/3 puis supprimer custom1 → le prochain ajout crée un **second** `variation-custom3`, et `getElementById` ne verra que le premier. | `main.js:238-300` (recalcul `:296`) |
| 15 | **Le `mimetype` de l'IDML est recompressé.** Les templates le stockent en `Stored` (convention OCF) mais `generate()` passe un `compression:'DEFLATE'` global. InDesign le tolère aujourd'hui, mais ça viole la spec OCF. Fix : `zip.file('mimetype', data, {compression:'STORE'})`. | `idml-generator.js:1949-1953` |
| 16 | **Génération de code sans échappement.** Le script Photoshop est construit par concaténation ; **seul `brandName`** est échappé. Un chemin contenant une apostrophe (`C:/Users/O'Brien/…`) produit un script syntaxiquement cassé qui meurt en silence — visible uniquement dans `_temp/mockups-build-debug.txt`. | `hostscript.jsx:2882-2884, 2896-2898, 2906-2913` (échappement `:2887`) |
| 17 | **Le nettoyage de `_temp/` casse le bouton « Re-tester mockups ».** Le script InDesign généré supprime tout `_temp/` à la fin ; `rerunMockupsFromDisk` a besoin de `_temp/mockups-ps-script.jsx`. Après une génération réussie, le bouton renvoie « mockups-ps-script.jsx introuvable ». Pour débugger les mockups, il faut interrompre la chaîne avant InDesign. | `hostscript.jsx:3271-3282` vs `:3312` |
| 18 | **Le script Photoshop généré quitte Photoshop.** Si PS n'était pas déjà lancé, un `_shouldClosePS = true` est ajouté et le script fait `$.sleep(3000)` puis `app.quit()`. Si le BridgeTalk vers InDesign n'est pas parti dans ces 3 secondes, la présentation ne s'ouvre jamais. | `hostscript.jsx:3201-3204, :3220` |

### Références mortes qui ont l'air vivantes (vérifiées par grep)

- `#reset-trial-btn` — référencé 2× dans `main.js` (`:685`, `:847`), **0 fois** dans `index.html`. Tout le bloc DEBUG et `Trial.reset()` sont inatteignables.
- `getInstalledFonts()` (`hostscript.jsx:2713`) — aucun appelant ; `main.js:1773` inline la même logique en string.
- `enablePlayerDebugMode()` (`hostscript.jsx:3428`) — aucun appelant ; `js/debug-mode-enabler.js` passe par Node.
- `convertAnyColorToRGB` / `convertColorManually` (`:57`, `:137`) — **mortes**, alors qu'elles gèrent SpotColor/LabColor/GrayColor. Conséquence : **un logo construit sur des nuanciers globaux/tons directs ne renvoie aucune couleur** et l'onglet couleurs custom apparaît vide sans erreur.
- `applyMonochromeToGradient` (`:718`) — morte. Du coup `applyColorRecursive` (`:879`) **aplatit les dégradés en couleur unie** en monochrome, alors que le chemin couleurs-custom (`:930`) les gère correctement. Deux comportements différents sur la même illustration.
- `extractColors` (`:560`), `hexToCMYKColor` (`:1131`) — mortes.
- `documentSettings.ppi` — lu puis seulement `$.writeln`é. **Jamais appliqué.** (`hostscript.jsx:1226-1234`)
- `appState.artboardSize` (`main.js:41`) et `appState.customColors.enabled` (`:38`) — jamais lus.
- **73 des 148 clés i18n** ne sont référencées nulle part (les 47 `stat_*`, les 4 `name_*`, les 2 `err_*`, les 3 `trial_*`…). Il n'y a **qu'un seul appel à `t()`** dans toute l'application : `main.js:1131`. Tout le reste des messages runtime est du français en dur.

---

## 11. État du repo & hygiène

- **`.git` fait 1,2 GB** pour 87 fichiers trackés — les 9 PSD (397 MiB) sont committés en blobs bruts, **sans LFS, sans `.gitattributes`**. Le commit `74965c9` (branche backup) les avait retirés en disant qu'ils dépassaient la limite GitHub ; `2c4d0d0` a supprimé les règles `.gitignore` et les a tous re-committés.
- **`core.autocrlf=true` sans `.gitattributes`** : les 12 checksums de `manifest.js` ont été calculés sur les octets CRLF du working copy Windows et diffèrent **tous les 12** de leurs blobs git normalisés LF. Cohérent aujourd'hui parce que les déploiements partent du CLI Vercel sur cette machine. Passer à l'intégration Git de Vercel, ou déployer depuis macOS/Linux/CI, casserait l'OTA en bloc.
- **`dist/` contient 401 MB d'artefacts périmés 1.0.0**, *à l'intérieur du dossier d'extension live* : `LogoDeclinaisons-1.0.0.zxp` (286 MB, 2026-03-23, antérieur à i18n donc incapable de satisfaire `index.html:435`) et `LogoDeclinaisons-Setup-1.0.0.exe` (134 MB, issu de l'installeur mort). Ni l'un ni l'autre n'est reproductible depuis HEAD.
- ✅ *2026-09-04 : `.claude/settings.local.json` a été détracké (`git rm --cached`) et ajouté à `.gitignore`.* Il pré-autorisait `Bash(curl:*)`, `Bash(npm install:*)`, `Bash(vercel --prod:*)`, `Bash(vercel env:*)` avec `deny` et `ask` vides — toute session d'agent clonant le repo héritait du droit de déployer en production sans confirmation. Le fichier local est conservé.
- ✅ *2026-09-04 : les trois fichiers `nul` parasites (`./nul`, `./templates/nul` 812 KB, `./backend-trial/nul`) et le dossier vide `templates/temp_extract/` ont été supprimés.* C'étaient des accidents de redirection `> nul` sous Git Bash (où NUL n'est pas un device) ; ils étaient gitignorés mais **pas invisibles pour les packagers** et finissaient dans le ZXP livré. Si ça se reproduit : `rm ./nul` **depuis bash**, jamais depuis cmd.exe.
- **Autre junk tracké** : `ZXPSignCmd.exe` (3,8 MB, toujours tracké — nécessaire au canal ZXP tant qu'il n'est pas supprimé) et `.debug` (**0 octet depuis le tout premier commit** → le debug distant CEP n'est en réalité pas configuré, il n'y a aucun port DevTools). ✅ *2026-09-04 : `unins000.exe` + `unins000.dat` (3,8 MB, désinstalleur Inno résiduel de `596de5b`) et `.rnd` (graine OpenSSL) ont été détrackés et gitignorés.*
- ✅ *2026-09-04 : `install.bat` et `optimize-mockups.jsx`, jusque-là non trackés, ont été committés.* `install.bat` est l'installeur xcopy de dev (seul script qui copie `templates/` dans une install Windows manuelle ; sa couverture PlayerDebugMode a été étendue à CSXS 9–14) et `optimize-mockups.jsx` un script Photoshop de downsampling **actuellement no-op** : les 9 PSD sont déjà tous ≤ 3000 px, le poids restant vient du nombre de calques et du payload des Smart Objects, pas de la résolution).
- **`certificate.p12` reste tracké** (voir §2.5) : le détracker changerait le comportement de signature sur un clone neuf sans bénéfice réel, la fuite étant déjà permanente dans l'historique. À traiter avec la décision « le canal ZXP est-il mort ? ».

---

## 12. Où on en est / ce qui reste

### Fait le 2026-09-04 (non testé dans Illustrator)

- Branche `backup-v1.0.2-full` poussée sur `origin` — les 11 commits d'historique unique sont sauvés
- `colorCount` corrigé (§10.3) · course au double-clic trial fermée sur Générer **et** Exporter (§6)
- Licence fantôme corrigée **des deux côtés** (`getStatus` + `canGenerate`) (§10.7) · désactivation normale purge enfin le disque (§10.8)
- `filesFailedé` → `filesFailed` (§10.10) · `@import` Inter remonté en ligne 1 (§10.11) · remplissage des sliders (§10.12)
- `installer.iss` + `install.bat` : PlayerDebugMode étendu à **CSXS 13/14** → Illustrator 2024+ se charge enfin sous Windows
- `template-2.idml` retiré des deux installeurs (fuite de chemins client, −7,3 Mo)
- Clé Lemon Squeezy sortie du code source · `installer-windows.iss` supprimé · 6 guides périmés annotés
- Versions alignées à 1.1.0 (`CSXS/manifest.xml`, `package.json`) · scripts npm cassés retirés
- Hygiène : `.claude/settings.local.json`, `unins000.*`, `.rnd` détrackés ; fichiers `nul` supprimés ; `install.bat` et `optimize-mockups.jsx` committés

### À faire, par ordre de priorité

1. **Ouvrir le panneau dans Illustrator et vérifier les correctifs ci-dessus.** Aucun n'a tourné pour de vrai. Regarder en priorité : le compteur de plans de travail, la typo du panneau (elle doit changer visuellement), le remplissage des sliders.
2. **Révoquer et régénérer la clé API Lemon Squeezy** (§2.5). Elle est toujours valide dans l'historique git. Action manuelle, dashboard LS.
3. **Vérifier `LEMONSQUEEZY_API_KEY` dans le dashboard Vercel** (§10.5). Si elle est absente, toutes les libérations de slot échouent en silence depuis toujours — probable cause des « limite d'activation atteinte ».
4. **Authentifier le webhook Lemon Squeezy** (§10.4). Non fait ici volontairement : le correctif exige `bodyParser: false` + parsing manuel du raw body, impossible à tester sans casser potentiellement toutes les révocations.
5. **Décider de la taille d'export** (§10.1). Non corrigé volontairement — c'est une décision produit, pas un bug à trancher seul :
   - (a) rendre les libellés honnêtes (« Petit (600 px) ») — zéro risque, mais le produit paraît moins bon ;
   - (b) corriger la formule pour que 1000 donne vraiment 1000 px — correct, mais change la sortie de tous les utilisateurs existants et pousse l'échelle à 666 % pour le préréglage 4000.
6. **Décider : l'OTA revient-il ?** (§2.3) Si oui → synchroniser `distribution/` + regénérer les 12 checksums (`filesFailed` est déjà corrigé). Si non → supprimer `js/auto-updater.js`, `installUpdate`, `distribution/`, `api/updates/*`.
7. **Décider : le canal ZXP est-il mort ?** Si oui → supprimer les 4 scripts, `ZXPSignCmd.exe`, `certificate.p12`, `INSTRUCTIONS-ZXP.txt`, `GUIDE-DISTRIBUTION.md`.
8. Corriger la taille custom W×H (§10.2), les IDs dupliqués des variations custom (§10.14), le désynchro du texte de sélection au changement de langue (§10.13).
9. Réécrire ou supprimer les 6 guides périmés (§2.7) — ils sont annotés, pas corrigés.
10. Passer les PSD en Git LFS. ⚠️ **Ne jamais elargir `.gitattributes` a `* text=auto`** : ça renormaliserait tout le repo en LF et casserait les 12 checksums de `manifest.js`, calculés sur les octets CRLF du working copy Windows (§11). Le `.gitattributes` ajouté le 2026-09-04 est volontairement limité aux `*.sh` / `*.command` et porte cet avertissement en commentaire.

## 13. Questions ouvertes (personne ne sait, décision utilisateur requise)

- Le `git reset --hard` du 2026-04-17 était-il volontaire ? Rien ne l'explique.
- `distribution/` est-il volontairement figé sur la 1.1.0 livrée, ou la synchro de `4a3a577` a-t-elle simplement été oubliée ? (Les fichiers `distribution/` sont horodatés 12:59 le jour même où `4a3a577` a été committé à 15:37 → ça ressemble à un oubli.)
- L'auto-install in-panel a-t-il été abandonné délibérément ? Il a été **construit et désactivé dans le même commit** `f6b915c` (« Release v1.1.0 with auto-update for all users »).
- Le trial-reset debug devait-il être supprimé entièrement (sa docstring dit « à retirer en production ») ou le bouton restauré ?
- `BLOB_READ_WRITE_TOKEN` existe dans `.env.local` mais rien sous `api/` ne référence Vercel Blob. Store externe ?
- Le trick du binaire stub a-t-il déjà produit un build notarisé vert ? Les commits `955b47c` → `b00d37a` → `2c4d0d0` s'enchaînent sur deux jours et se lisent comme une session de debug inachevée ; aucun commit ne confirme un succès.
