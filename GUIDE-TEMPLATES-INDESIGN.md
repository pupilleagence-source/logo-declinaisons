# Guide des variables pour les templates InDesign (.idml)

## Textes (placeholders dans les TextFrames)

Ecrire ces variables directement dans le contenu texte du template InDesign.
Les placeholders non-utilisés seront remplacés par `-`.

### Nom de la marque

| Variable | Exemple de sortie |
|---|---|
| `{{BRAND_NAME}}` | `Ma Marque` |

### Typographies (saisies par l'utilisateur)

| Variable | Exemple de sortie |
|---|---|
| `{{FONT_PRIMARY}}` | `Montserrat` |
| `{{FONT_SECONDARY}}` | `Open Sans` |

> Affiche le nom de la police saisie dans les champs "Police principale" et "Police secondaire" de l'UI. Si le champ est vide, affiche `-`.

### Couleurs de la marque (issues de "Analyser les couleurs")

| Variable | Exemple de sortie |
|---|---|
| `{{COLOR_1_HEX}}` | `#FF5733` |
| `{{COLOR_1_RGB}}` | `R:255 G:87 B:51` |
| `{{COLOR_1_CMYK}}` | `C:0 M:66 Y:80 K:0` |
| `{{COLOR_2_HEX}}` | `#0047AB` |
| `{{COLOR_2_RGB}}` | `R:0 G:71 B:171` |
| `{{COLOR_2_CMYK}}` | `C:100 M:58 Y:0 K:33` |
| `{{COLOR_3_HEX}}` | ... |
| `{{COLOR_3_RGB}}` | ... |
| `{{COLOR_3_CMYK}}` | ... |

> Le nombre de couleurs depend du logo analyse. Prevoir `COLOR_1` a `COLOR_5` dans le template pour couvrir la plupart des cas.

### Couleurs customs (choisies par l'utilisateur)

| Variable | Exemple de sortie |
|---|---|
| `{{CUSTOM_1_HEX}}` | `#222222` |
| `{{CUSTOM_1_RGB}}` | `R:34 G:34 B:34` |
| `{{CUSTOM_1_CMYK}}` | `C:0 M:0 Y:0 K:87` |
| `{{CUSTOM_2_HEX}}` | `#FF0000` |
| `{{CUSTOM_2_RGB}}` | `R:255 G:0 B:0` |
| `{{CUSTOM_2_CMYK}}` | `C:0 M:100 Y:100 K:0` |
| `{{CUSTOM_3_HEX}}` | ... |

> Ce sont les couleurs de remplacement choisies par l'utilisateur dans l'UI. Si l'utilisateur ne les modifie pas, elles sont identiques aux couleurs originales.

### Couleurs monochromie

| Variable | Defaut | Exemple de sortie |
|---|---|---|
| `{{MONO_DARK_HEX}}` | `#000000` | `#000000` |
| `{{MONO_DARK_RGB}}` | noir | `R:0 G:0 B:0` |
| `{{MONO_DARK_CMYK}}` | noir | `C:0 M:0 Y:0 K:100` |
| `{{MONO_LIGHT_HEX}}` | `#FFFFFF` | `#FFFFFF` |
| `{{MONO_LIGHT_RGB}}` | blanc | `R:255 G:255 B:255` |
| `{{MONO_LIGHT_CMYK}}` | blanc | `C:0 M:0 Y:0 K:0` |

> Les valeurs changent si l'utilisateur modifie les couleurs de monochromie dans l'onglet Couleur.

---

## Nuancier (swatches dans le Nuancier InDesign)

Creer ces nuances dans le Nuancier InDesign avec une couleur placeholder quelconque.
Le code remplacera automatiquement leurs valeurs RGB.
Tous les elements utilisant ces nuances seront mis a jour par InDesign.

### Couleurs de la marque (originales)

| Nom de la nuance | Correspond a |
|---|---|
| `BRAND_COLOR_1` | 1ere couleur detectee |
| `BRAND_COLOR_2` | 2eme couleur detectee |
| `BRAND_COLOR_3` | 3eme couleur detectee |
| ... | ... |

### Couleurs customs (remplacement choisi par l'utilisateur)

| Nom de la nuance | Correspond a |
|---|---|
| `BRAND_CUSTOM_1` | 1ere couleur custom choisie |
| `BRAND_CUSTOM_2` | 2eme couleur custom choisie |
| `BRAND_CUSTOM_3` | 3eme couleur custom choisie |
| ... | ... |

> Si l'utilisateur ne modifie pas les couleurs, `BRAND_CUSTOM_N` aura la meme valeur que `BRAND_COLOR_N`.

### Couleurs monochromie

| Nom de la nuance | Correspond a |
|---|---|
| `BRAND_MONO_DARK` | Couleur monochromie dark (noir par defaut) |
| `BRAND_MONO_LIGHT` | Couleur monochromie light (blanc par defaut) |

---

## Frames images (nommage via panneau Calques)

Nommer les frames image dans le panneau Calques d'InDesign.
Format : `LOGO_{TYPE}_{COULEUR}` en MAJUSCULES.

Si le logo correspondant existe dans le dossier d'export, l'image sera liee.
Si le logo n'existe pas, le frame entier sera supprime du document.

### Types disponibles

| Type | Description |
|---|---|
| `HORIZONTAL` | Version horizontale |
| `VERTICAL` | Version verticale |
| `ICON` | Icone seule |
| `TEXT` | Typographie seule |
| `CUSTOM1` | Variation custom 1 |
| `CUSTOM2` | Variation custom 2 |
| `CUSTOM3` | Variation custom 3 |

### Couleurs disponibles

| Couleur | Description |
|---|---|
| `ORIGINAL` | Couleurs d'origine |
| `BLACKWHITE` | Nuances de gris |
| `MONOCHROME` | Monochromie dark |
| `MONOCHROMELIGHT` | Monochromie light |
| `CUSTOM` | Couleurs customs |

### Exemples de noms de frames

```
LOGO_HORIZONTAL_ORIGINAL
LOGO_HORIZONTAL_BLACKWHITE
LOGO_HORIZONTAL_MONOCHROME
LOGO_HORIZONTAL_MONOCHROMELIGHT
LOGO_HORIZONTAL_CUSTOM
LOGO_VERTICAL_ORIGINAL
LOGO_VERTICAL_BLACKWHITE
LOGO_ICON_ORIGINAL
LOGO_ICON_MONOCHROME
LOGO_TEXT_ORIGINAL
LOGO_CUSTOM1_ORIGINAL
...
```

> Toutes les combinaisons TYPE x COULEUR sont possibles.
> Les frames dont le logo n'existe pas seront automatiquement supprimes.

---

## Blocs conditionnels (affichage dynamique)

Nommer des elements (Group, Rectangle, TextFrame) dans le panneau Calques.
Si la donnee correspondante n'existe pas, le bloc est **supprime** du document genere.

### Blocs couleurs

| Nom du bloc | Supprime si... |
|---|---|
| `BLOCK_COLOR_1` | Aucune couleur 1 detectee |
| `BLOCK_COLOR_2` | Aucune couleur 2 detectee |
| `BLOCK_COLOR_3` | Aucune couleur 3 detectee |
| `BLOCK_COLOR_4` | Aucune couleur 4 detectee |
| `BLOCK_CUSTOM_1` | Pas de couleur custom 1 (ou identique a l'originale) |
| `BLOCK_CUSTOM_2` | Pas de couleur custom 2 |
| `BLOCK_CUSTOM_3` | Pas de couleur custom 3 |
| `BLOCK_CUSTOM_4` | Pas de couleur custom 4 |

### Blocs logos

| Nom du bloc | Supprime si... |
|---|---|
| `BLOCK_LOGO_HORIZONTAL` | Aucun logo horizontal exporte |
| `BLOCK_LOGO_VERTICAL` | Aucun logo vertical exporte |
| `BLOCK_LOGO_ICON` | Aucun insigne/icone exporte |
| `BLOCK_LOGO_TEXT` | Aucun logo texte exporte |
| `BLOCK_LOGO_CUSTOM1` | Aucune variation custom 1 exportee |
| `BLOCK_LOGO_CUSTOM2` | Aucune variation custom 2 exportee |
| `BLOCK_LOGO_CUSTOM3` | Aucune variation custom 3 exportee |

> Le bloc est supprime si l'utilisateur n'a pas selectionne/exporte la variation correspondante. Si au moins une couleur (original, blackwhite, monochrome...) existe pour ce type, le bloc reste.

### Comment utiliser

1. Creer un **Group** dans InDesign contenant tous les elements du bloc (rectangle de couleur, texte hex, label...)
2. Nommer le Group dans le panneau Calques (ex: `BLOCK_COLOR_3` ou `BLOCK_LOGO_VERTICAL`)
3. Si la donnee n'existe pas, le Group entier sera supprime

> Les blocs mono (dark/light) n'ont pas besoin de condition car ils sont toujours presents.
> Fonctionne aussi avec des Rectangle ou TextFrame individuels (pas seulement des Groups).

### Exemple de structure dans le panneau Calques

```
Page 1 (couleurs)
  BLOCK_COLOR_1          (Group: rectangle + texte hex)
  BLOCK_COLOR_2          (Group: rectangle + texte hex)
  BLOCK_COLOR_3          (Group: rectangle + texte hex)
  BLOCK_COLOR_4          (Group: rectangle + texte hex)
  Bloc Mono Dark         (pas de prefix BLOCK_, toujours affiche)
  Bloc Mono Light        (pas de prefix BLOCK_, toujours affiche)

Page 2 (customs) — page conditionnelle
  PAGE_CUSTOM            (petit element marqueur, ex: rectangle 1x1 hors page)
  BLOCK_CUSTOM_1         (Group: rectangle + texte hex)
  BLOCK_CUSTOM_2         (Group: rectangle + texte hex)
  BLOCK_CUSTOM_3         (Group: rectangle + texte hex)
  BLOCK_CUSTOM_4         (Group: rectangle + texte hex)

Page 3 (logos)
  BLOCK_LOGO_HORIZONTAL  (Group: logo horizontal + label)
  BLOCK_LOGO_VERTICAL    (Group: logo vertical + label)
  BLOCK_LOGO_ICON        (Group: insigne + label)
  BLOCK_LOGO_TEXT        (Group: logo texte + label)
  BLOCK_LOGO_CUSTOM1     (Group: variation custom 1 + label)
```

---

## Pages conditionnelles (pages entieres)

Certaines pages ne doivent apparaitre que si des donnees existent.
Placer un element marqueur (petit rectangle hors page ou masque) avec un nom special.
Si la condition n'est pas remplie, **la page entiere est supprimee** du document.

| Nom du marqueur | Page supprimee si... |
|---|---|
| `PAGE_CUSTOM` | Aucune couleur custom n'a ete modifiee par l'utilisateur |
| `PAGE_TYPO_SECONDARY` | Aucune typographie secondaire n'a ete definie par l'utilisateur |

### Comment utiliser

1. Creer la page dediee (customs, typographie secondaire, etc.) dans le template InDesign
2. Placer un petit element (rectangle 1x1 pt) n'importe ou sur cette page
3. Nommer cet element avec le marqueur approprie (`PAGE_CUSTOM`, `PAGE_TYPO_SECONDARY`) dans le panneau Calques
4. Si la condition n'est pas remplie → la page disparait du document genere
5. Sinon → la page reste

> L'element marqueur peut etre minuscule et place hors de la zone visible de la page.
> Combiner avec `BLOCK_CUSTOM_N` sur la meme page pour afficher/masquer chaque couleur individuellement.

### Note sur la typographie secondaire

Quand l'utilisateur ne definit qu'une seule typographie (primaire) :
- La page marquee `PAGE_TYPO_SECONDARY` est supprimee du document
- Le style de paragraphe `BRAND_SECONDARY` utilise automatiquement la typographie primaire

---

## Zones de protection (clear space)

Pages dediees montrant la zone d'exclusion autour du logo.
Le code place le logo, calcule ses dimensions reelles, puis repositionne les elements indicateurs.

### Elements a placer sur la page

| Nom de l'element | Type | Role |
|---|---|---|
| `ZONE_{TYPE}_{COLOR}` | Rectangle | Frame pour le logo (ex: `ZONE_HORIZONTAL_MONOCHROME`) |
| `ZONE_BORDER_{TYPE}` | Rectangle | Bordure autour du logo rendu (repositionne automatiquement) |
| `ZONE_EXCLUSION_{TYPE}` | Rectangle | Zone d'exclusion = logo + marge (repositionne automatiquement) |
| `ZONE_FILL_{TYPE}` | Rectangle | Remplissage de la zone d'exclusion (optionnel, repositionne automatiquement) |
| `ZONE_MARGIN_TEXT_{TYPE}` | TextFrame | Texte affichant la valeur de marge (repositionne dans la zone d'exclusion) |

> Pour les pages avec **une seule zone**, les noms generiques `ZONE_BORDER`, `ZONE_EXCLUSION`, `ZONE_FILL`, `ZONE_MARGIN_TEXT` (sans suffixe `_{TYPE}`) fonctionnent aussi.
> Pour les pages avec **plusieurs zones**, le suffixe `_{TYPE}` est obligatoire pour distinguer les elements.

### Types et couleurs disponibles

Memes valeurs que pour les frames `LOGO_` :
- Types : `HORIZONTAL`, `VERTICAL`, `ICON`, `TEXT`, `CUSTOM1`, `CUSTOM2`, `CUSTOM3`
- Couleurs : `ORIGINAL`, `BLACKWHITE`, `MONOCHROME`, `MONOCHROMELIGHT`, `CUSTOM`

### Placeholders texte

| Variable | Exemple de sortie | Description |
|---|---|---|
| `{{ZONE_MARGIN_PCT}}` | `15` | Pourcentage de marge choisi par l'utilisateur (nombre seul) |
| `{{ZONE_MARGIN_VALUE}}` | `9%` | Pourcentage relatif a la largeur du logo horizontal |
| `{{ZONE_MARGIN_VALUE_HORIZONTAL}}` | `9%` | Idem (pour affichage sur zone horizontal) |
| `{{ZONE_MARGIN_VALUE_ICON}}` | `15%` | Pourcentage choisi par l'utilisateur (pour affichage sur zone icon) |

> **Calcul de la marge :**
> 1. La marge en pixels est calculee a partir du logo **icon** : `marginPx = icon.max * pourcentage`
> 2. Cette **meme marge en pixels** est appliquee a toutes les zones
> 3. Pour l'affichage :
>    - **Icon** : affiche le pourcentage utilisateur (ex: 15%)
>    - **Horizontal** : affiche le pourcentage recalcule relatif a sa largeur (ex: 9%)
>
> **Exemple :** Utilisateur choisit 15%. Icon 100x100 → marginPx = 15px. Horizontal 166x50 → affichage = 15/166 = **9%**

### Comment utiliser

1. Placer un grand Rectangle nomme `ZONE_HORIZONTAL_MONOCHROME` (frame logo)
2. Placer un Rectangle `ZONE_BORDER_HORIZONTAL` avec contour tirete (style libre dans InDesign)
3. Placer un Rectangle `ZONE_EXCLUSION_HORIZONTAL` avec contour tirete + fond semi-transparent
4. Optionnel : Rectangle `ZONE_FILL_HORIZONTAL` pour un fond colore
5. Optionnel : TextFrame avec `{{ZONE_MARGIN_PCT}}%` pour afficher la valeur
6. Repeter pour chaque variante souhaitee sur la meme page ou sur des pages separees

> Les positions initiales de ZONE_BORDER, ZONE_EXCLUSION et ZONE_FILL n'ont pas d'importance.
> Le code les repositionnera automatiquement autour du logo rendu.

### Suppression automatique

- Si **toutes** les zones d'une page ont un logo absent → **la page entiere est supprimee**
- Si **certaines** zones ont un logo absent (page multi-zones) → seuls les elements de cette zone sont supprimes, la page reste

### Exemple 1 : une zone par page

```
Page 3 — Zone protection horizontal
  ZONE_HORIZONTAL_MONOCHROME  (frame logo, ex: 300x300 pt)
  ZONE_BORDER                 (rectangle tirete, position quelconque)
  ZONE_EXCLUSION              (rectangle tirete + fond 15% opacite)
  Texte: "Zone de protection : {{ZONE_MARGIN_PCT}}%"
```

> Avec une seule zone par page, les noms generiques `ZONE_BORDER` / `ZONE_EXCLUSION` suffisent.

### Exemple 2 : plusieurs zones sur la meme page

```
Page 3 — Zones de protection
  ZONE_HORIZONTAL_MONOCHROME  (frame logo horizontal)
  ZONE_BORDER_HORIZONTAL      (rectangle tirete pour horizontal)
  ZONE_EXCLUSION_HORIZONTAL   (zone d'exclusion pour horizontal)
  ZONE_MARGIN_TEXT_HORIZONTAL (TextFrame avec "{{ZONE_MARGIN_VALUE_HORIZONTAL}}")

  ZONE_ICON_MONOCHROME        (frame logo icon)
  ZONE_BORDER_ICON            (rectangle tirete pour icon)
  ZONE_EXCLUSION_ICON         (zone d'exclusion pour icon)
  ZONE_MARGIN_TEXT_ICON       (TextFrame avec "{{ZONE_MARGIN_VALUE_ICON}}")
```

> Le suffixe `_{TYPE}` (ex: `_HORIZONTAL`, `_ICON`) lie chaque element indicateur a sa zone.
> Si le logo icon n'existe pas, seuls les elements `*_ICON` sont supprimes — le reste de la page est conserve.
> Le TextFrame `ZONE_MARGIN_TEXT_{TYPE}` est repositionne automatiquement dans la bande de marge superieure.

### Calcul de la marge

La marge est **unifiee** pour toutes les zones, basee sur le logo de reference :

1. **Logo de reference** : icon (prioritaire) ou text
2. **Calcul** : `marginPx = max(refLogo.width, refLogo.height) * pourcentage / 100`
3. **Application** : cette marge en pixels est appliquee a TOUTES les zones
4. **Affichage** : `displayPct = marginPx / horizontal.width * 100`

**Exemple :**
- Utilisateur choisit 10% de marge
- Icon = 100x100 pt → marginPx = 100 * 0.10 = **10 pt**
- Horizontal = 200x50 pt → meme marge de 10 pt appliquee
- Affichage = 10 / 200 * 100 = **5%** (relatif a la largeur du logo horizontal)

---

## Interdictions (mauvais usages du logo)

Page montrant les exemples d'utilisation incorrecte du logo.
Le code place automatiquement le logo horizontal avec des transformations specifiques.

### Convention de nommage

```
PROHIB_{TYPE}_{COLOR}

TYPE = STRETCH | SHADOW | ZONE | VARIATION | COLOR | FONT | ELEMENT
COLOR = ORIGINAL | BLACKWHITE | MONOCHROME | MONOCHROMELIGHT | CUSTOM
```

### Types de transformation

| Type | Effet applique | Description |
|---|---|---|
| `STRETCH` | **Automatique** | Logo etire (deformation non-uniforme) |
| `SHADOW` | **Automatique** | Ombre portee ajoutee |
| `COLOR` | **Automatique** | Teinte magenta appliquee (mauvaise couleur) |
| `ZONE` | Semi-auto | Logo normal, designer ajoute texte qui chevauche |
| `VARIATION` | Semi-auto | Logo normal, designer cree mauvais agencement |
| `FONT` | Semi-auto | Logo normal, designer ajoute texte avec mauvaise font |
| `ELEMENT` | Semi-auto | Logo normal, designer ajoute forme (etoile, etc.) |

**Automatique** = le code applique la transformation sur l'image placee
**Semi-auto** = le code place le logo normalement, le designer cree l'element "mauvais" dans InDesign

### Exemple de structure

```
Page 7 — Interdictions
  Titre: "Utilisation incorrecte du logo"

  Rangee 1:
    PROHIB_STRETCH_ORIGINAL    + texte "Ne pas deformer"
    PROHIB_SHADOW_ORIGINAL     + texte "Ne pas ajouter d'effet"
    PROHIB_ZONE_ORIGINAL       + texte "Respecter la zone" + [texte chevauche]
    PROHIB_VARIATION_ORIGINAL  + texte "Ne pas modifier" + [arrangement manuel]

  Rangee 2:
    PROHIB_COLOR_ORIGINAL      + texte "Respecter les couleurs"
    PROHIB_FONT_ORIGINAL       + texte "Conserver la typo" + [mauvaise font]
    PROHIB_ELEMENT_ORIGINAL    + texte "Ne pas ajouter" + [forme ajoutee]
```

### Comment utiliser

1. Creer 8 rectangles graphiques sur la page interdictions
2. Nommer chaque frame selon le type d'interdiction (ex: `PROHIB_STRETCH_ORIGINAL`)
3. Pour les types **automatiques** (STRETCH, SHADOW, COLOR), le frame reste vide — le code appliquera la transformation
4. Pour les types **semi-auto**, ajouter manuellement l'element "mauvais" (texte qui chevauche, forme, etc.)
5. Ajouter les textes descriptifs a cote de chaque exemple

> Le logo est selectionne par ordre de priorite : **vertical** > **horizontal** > **text** > **icon**.
> Le premier type disponible dans la couleur demandee est utilise.
> Si aucun logo n'est disponible, le frame sera supprime.

### Transformations techniques

**STRETCH (etirement):**
- scaleX = 1.4 (140% en largeur)
- scaleY = 0.7 (70% en hauteur)
- Resultat: logo deforme horizontalement

**SHADOW (ombre portee):**
- XOffset/YOffset: 5 pt
- Blur: 8 pt
- Opacite: 75%
- Couleur: noir

**COLOR (mauvaise couleur):**
- Effet: InnerShadow avec blend mode "Color"
- Couleur: RVB Magenta (R=255 G=0 B=255)
- ChokeAmount: 100% (remplit toute la forme)
- Opacite: 80%
- Resultat: logo teinte en magenta

---

## Mockups Photoshop (integration automatique)

Integre automatiquement les logos dans des mockups PSD, exporte en PNG et lie au IDML.

### Ajouter un mockup en 3 etapes

1. Placer le fichier PSD dans `templates/mockups/` (ex: `tote-bag.psd`)
2. Nommer les calques speciaux dans le PSD (voir conventions ci-dessous)
3. Creer une frame dans le template InDesign nommee `MOCKUP_TOTE-BAG`

C'est tout. Le reste est automatique.

### Convention de nommage des calques PSD

#### Calques Logo (Smart Object)

| Nom du calque | Logo insere |
|---|---|
| `LOGO` | Horizontal (defaut) |
| `LOGO_HORIZONTAL` | Horizontal |
| `LOGO_VERTICAL` | Vertical |
| `LOGO_ICON` | Icone |
| `LOGO_TEXT` | Texte seul |
| `LOGO_CUSTOM1` | Custom 1 |
| `LOGO_CUSTOM2` | Custom 2 |
| `LOGO_CUSTOM3` | Custom 3 |

Le logo est redimensionne a **75% du canvas** du smart object et centre.
Un meme PSD peut contenir **plusieurs calques LOGO_*** pour placer differentes variations.

#### Calques Couleur (Solid Fill / Aplat)

| Nom du calque | Couleur appliquee |
|---|---|
| `COLOR_1` | Couleur principale de la marque |
| `COLOR_2` | 2eme couleur |
| `COLOR_3` | 3eme couleur |
| `COLOR_4` | 4eme couleur |
| `COLOR_5` | 5eme couleur |

Les couleurs sont extraites automatiquement du logo. Seuls les calques de type **Solid Fill** (aplat de couleur) sont modifies.

#### Calques ignores

Tous les autres calques (groupes, effets de lumiere, ombres, fond, textures...) ne sont **pas touches** par le script.

### Exemple de structure PSD

```
tote-bag.psd
  Bag [Group]
    LOGO [SmartObject]         <- logo horizontal insere ici
    Bag [Normal]
  Handle [Group]
    COLOR_1 [SolidFill]        <- colore avec la couleur principale
    Handle [Normal]
    Light Effects [Group]
  Background [Group]
    Photo [Normal]
```

```
business-card.psd
  Front [Group]
    LOGO_HORIZONTAL [SmartObject]  <- logo horizontal
    COLOR_1 [SolidFill]            <- fond couleur principale
  Back [Group]
    LOGO_ICON [SmartObject]        <- icone au dos
    COLOR_2 [SolidFill]            <- accent 2eme couleur
```

### Convention Frame IDML

Format : `MOCKUP_{NOM_DU_PSD}` en MAJUSCULES

| Fichier PSD | Nom du frame IDML | Image exportee |
|---|---|---|
| `business-card.psd` | `MOCKUP_BUSINESS-CARD` | `mockups/business-card.png` |
| `letterhead.psd` | `MOCKUP_LETTERHEAD` | `mockups/letterhead.png` |
| `tote-bag.psd` | `MOCKUP_TOTE-BAG` | `mockups/tote-bag.png` |

### Flux de traitement

1. Le generateur IDML scanne `templates/mockups/` pour les fichiers `.psd`
2. Les frames `MOCKUP_*` recoivent un lien vers le futur PNG
3. Illustrator pre-convertit les logos vectoriels (SVG) en PNG haute resolution
4. BridgeTalk envoie un script a Photoshop qui, pour chaque PSD :
   - Ouvre le PSD
   - Applique les couleurs aux calques `COLOR_N`
   - Remplace chaque calque `LOGO_*` avec la variation correspondante
   - Exporte en PNG-24 avec transparence
   - Ferme le PSD sans sauvegarder
5. Photoshop envoie un BridgeTalk a InDesign pour ouvrir le IDML

### Gestion des erreurs

| Cas | Comportement |
|---|---|
| Pas de Photoshop installe | Ouverture InDesign sans mockups, liens manquants |
| Pas de fichiers PSD | Aucun traitement Photoshop, ouverture InDesign directe |
| PSD sans calque `LOGO_*` | Fallback: utilise le premier Smart Object trouve |
| Variation demandee absente | Fallback: utilise le logo horizontal |
| Pas de logo exporte | Tous les mockups sont ignores |
| Frame `MOCKUP_*` sans PSD | Frame supprime du document |
| Pas de couleurs detectees | Les calques `COLOR_N` restent inchanges |

---

## Styles de paragraphe (typographie dynamique)

Creer ces styles de paragraphe dans InDesign.
Si l'utilisateur saisit une police dans l'UI, elle remplacera celle du style.
Si le champ est laisse vide, la police du template est conservee.

| Nom du style | Utilisation |
|---|---|
| `BRAND_PRIMARY` | Titres, nom de marque, headings |
| `BRAND_SECONDARY` | Corps de texte, descriptions |

> Appliquer ces styles aux textes du template. Ne pas utiliser de formatage direct (override) pour la police, sinon InDesign ne prendra pas le style en compte.

---

## Resume rapide

```
TEXTES:
  {{BRAND_NAME}}              Nom de la marque
  {{FONT_PRIMARY}}            Police principale (saisie par l'utilisateur)
  {{FONT_SECONDARY}}          Police secondaire (saisie par l'utilisateur)
  {{COLOR_N_HEX/RGB/CMYK}}   Couleurs originales detectees
  {{CUSTOM_N_HEX/RGB/CMYK}}  Couleurs customs choisies
  {{MONO_DARK_HEX/RGB/CMYK}}  Monochromie dark
  {{MONO_LIGHT_HEX/RGB/CMYK}} Monochromie light
  {{ZONE_MARGIN_PCT}}          Pourcentage de marge choisi par l'utilisateur
  {{ZONE_MARGIN_VALUE}}         Pourcentage relatif a la largeur du logo horizontal

NUANCIER:
  BRAND_COLOR_1, _2, _3...    Couleurs originales
  BRAND_CUSTOM_1, _2, _3...   Couleurs customs
  BRAND_MONO_DARK              Monochromie dark
  BRAND_MONO_LIGHT             Monochromie light

FRAMES IMAGES:
  LOGO_{TYPE}_{COULEUR}        Ex: LOGO_HORIZONTAL_ORIGINAL

BLOCS CONDITIONNELS:
  BLOCK_COLOR_N                Supprime si couleur N absente
  BLOCK_CUSTOM_N               Supprime si custom N absent
  BLOCK_LOGO_HORIZONTAL        Supprime si logo horizontal absent
  BLOCK_LOGO_VERTICAL          Supprime si logo vertical absent
  BLOCK_LOGO_ICON              Supprime si insigne absent
  BLOCK_LOGO_TEXT              Supprime si logo texte absent
  BLOCK_LOGO_CUSTOM1/2/3      Supprime si variation custom absente

PAGES CONDITIONNELLES:
  PAGE_CUSTOM                  Page supprimee si aucun custom
  PAGE_TYPO_SECONDARY          Page supprimee si typo secondaire absente

ZONES DE PROTECTION:
  ZONE_{TYPE}_{COLOR}          Frame logo (ex: ZONE_HORIZONTAL_MONOCHROME)
  ZONE_BORDER_{TYPE}           Bordure du logo rendu (repositionne)
  ZONE_EXCLUSION_{TYPE}        Zone d'exclusion logo+marge (repositionne)
  ZONE_FILL_{TYPE}             Remplissage zone (optionnel, repositionne)
  ZONE_MARGIN_TEXT_{TYPE}      Texte de marge (repositionne dans zone exclusion)
  (noms generiques sans _{TYPE} aussi supportes en mono-zone)

INTERDICTIONS (mauvais usages):
  PROHIB_STRETCH_{COLOR}       Logo etire (transformation auto)
  PROHIB_SHADOW_{COLOR}        Logo avec ombre portee (effet auto)
  PROHIB_COLOR_{COLOR}         Logo teinte magenta (effet auto)
  PROHIB_ZONE_{COLOR}          Logo normal (designer ajoute texte chevauche)
  PROHIB_VARIATION_{COLOR}     Logo normal (designer cree mauvais agencement)
  PROHIB_FONT_{COLOR}          Logo normal (designer ajoute mauvaise font)
  PROHIB_ELEMENT_{COLOR}       Logo normal (designer ajoute forme)

MOCKUPS PHOTOSHOP:
  MOCKUP_{NOM_DU_PSD}          Ex: MOCKUP_BUSINESS-CARD (→ business-card.psd)
  Dossier PSD: templates/mockups/
  Calque requis: Smart Object nomme "LOGO"

STYLES DE PARAGRAPHE:
  BRAND_PRIMARY                Police principale
  BRAND_SECONDARY              Police secondaire
```
