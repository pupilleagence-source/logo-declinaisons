# Guide des variables pour les templates InDesign (.idml)

## Textes (placeholders dans les TextFrames)

Ecrire ces variables directement dans le contenu texte du template InDesign.
Les placeholders non-utilisés seront remplacés par `-`.

### Nom de la marque

| Variable | Exemple de sortie |
|---|---|
| `{{BRAND_NAME}}` | `Ma Marque` |

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

### Comment utiliser

1. Creer un **Group** dans InDesign contenant tous les elements du bloc (rectangle de couleur, texte hex, label...)
2. Nommer le Group dans le panneau Calques (ex: `BLOCK_COLOR_3`)
3. Si la couleur 3 n'existe pas, le Group entier sera supprime

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
```

---

## Pages conditionnelles (pages entieres)

Certaines pages ne doivent apparaitre que si des donnees existent.
Placer un element marqueur (petit rectangle hors page ou masque) avec un nom special.
Si la condition n'est pas remplie, **la page entiere est supprimee** du document.

| Nom du marqueur | Page supprimee si... |
|---|---|
| `PAGE_CUSTOM` | Aucune couleur custom n'a ete modifiee par l'utilisateur |

### Comment utiliser

1. Creer la page dediee aux couleurs customs dans le template InDesign
2. Placer un petit element (rectangle 1x1 pt) n'importe ou sur cette page
3. Nommer cet element `PAGE_CUSTOM` dans le panneau Calques
4. Si l'utilisateur n'a pas de couleurs customs → la page disparait du document genere
5. Si l'utilisateur a au moins 1 couleur custom → la page reste

> L'element marqueur peut etre minuscule et place hors de la zone visible de la page.
> Combiner avec `BLOCK_CUSTOM_N` sur la meme page pour afficher/masquer chaque couleur individuellement.

---

## Zones de protection (clear space)

Pages dediees montrant la zone d'exclusion autour du logo.
Le code place le logo, calcule ses dimensions reelles, puis repositionne les elements indicateurs.

### Elements a placer sur la page

| Nom de l'element | Type | Role |
|---|---|---|
| `ZONE_{TYPE}_{COLOR}` | Rectangle | Frame pour le logo (ex: `ZONE_HORIZONTAL_ORIGINAL`) |
| `ZONE_BORDER` | Rectangle | Bordure autour du logo rendu (repositionne automatiquement) |
| `ZONE_EXCLUSION` | Rectangle | Zone d'exclusion = logo + marge (repositionne automatiquement) |
| `ZONE_FILL` | Rectangle | Remplissage de la zone d'exclusion (optionnel, repositionne automatiquement) |

### Types et couleurs disponibles

Memes valeurs que pour les frames `LOGO_` :
- Types : `HORIZONTAL`, `VERTICAL`, `ICON`, `TEXT`, `CUSTOM1`, `CUSTOM2`, `CUSTOM3`
- Couleurs : `ORIGINAL`, `BLACKWHITE`, `MONOCHROME`, `MONOCHROMELIGHT`, `CUSTOM`

### Placeholder texte

| Variable | Exemple de sortie |
|---|---|
| `{{ZONE_MARGIN_PCT}}` | `15` |

> Affiche la valeur du pourcentage de marge choisie par l'utilisateur (slider 5-40%, defaut 15%).

### Comment utiliser

1. Creer une page dediee pour chaque variante de logo souhaitee
2. Placer un grand Rectangle nomme `ZONE_HORIZONTAL_ORIGINAL` (frame logo)
3. Placer un Rectangle `ZONE_BORDER` avec contour tirete (style libre dans InDesign)
4. Placer un Rectangle `ZONE_EXCLUSION` avec contour tirete + fond semi-transparent
5. Optionnel : Rectangle `ZONE_FILL` pour un fond colore
6. Optionnel : TextFrame avec `{{ZONE_MARGIN_PCT}}%` pour afficher la valeur

> Les positions initiales de ZONE_BORDER, ZONE_EXCLUSION et ZONE_FILL n'ont pas d'importance.
> Le code les repositionnera automatiquement autour du logo rendu.

### Suppression automatique

Si le logo correspondant au `ZONE_{TYPE}_{COLOR}` n'existe pas dans l'export,
**la page entiere est supprimee** du document genere.

### Exemple de structure dans le panneau Calques

```
Page 3 — Zone protection horizontal
  ZONE_HORIZONTAL_ORIGINAL   (frame logo, ex: 300x300 pt)
  ZONE_BORDER                (rectangle tirete, position quelconque)
  ZONE_EXCLUSION             (rectangle tirete + fond 15% opacite)
  Texte: "Zone de protection : {{ZONE_MARGIN_PCT}}%"

Page 4 — Zone protection icon
  ZONE_ICON_ORIGINAL         (frame logo)
  ZONE_BORDER                (rectangle tirete)
  ZONE_EXCLUSION             (rectangle tirete + fond)

Page 5 — Zone protection vertical
  ZONE_VERTICAL_ORIGINAL     (frame logo)
  ZONE_BORDER                (rectangle tirete)
  ZONE_EXCLUSION             (rectangle tirete + fond)
```

> Si l'utilisateur n'a pas exporte de logo icon → la page 4 est supprimee automatiquement.

### Calcul de la marge

La marge est calculee en pourcentage de la plus grande dimension du logo rendu :
`marginPx = max(largeur, hauteur) * pourcentage / 100`

Exemple : logo rendu de 200x100 pt avec marge 15% → `margin = 200 * 0.15 = 30 pt`

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
  {{COLOR_N_HEX/RGB/CMYK}}   Couleurs originales detectees
  {{CUSTOM_N_HEX/RGB/CMYK}}  Couleurs customs choisies
  {{MONO_DARK_HEX/RGB/CMYK}}  Monochromie dark
  {{MONO_LIGHT_HEX/RGB/CMYK}} Monochromie light
  {{ZONE_MARGIN_PCT}}          Pourcentage de marge zone protection

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

PAGES CONDITIONNELLES:
  PAGE_CUSTOM                  Page supprimee si aucun custom

ZONES DE PROTECTION:
  ZONE_{TYPE}_{COLOR}          Frame logo (ex: ZONE_HORIZONTAL_ORIGINAL)
  ZONE_BORDER                  Bordure du logo rendu (repositionne)
  ZONE_EXCLUSION               Zone d'exclusion logo+marge (repositionne)
  ZONE_FILL                    Remplissage zone (optionnel, repositionne)

STYLES DE PARAGRAPHE:
  BRAND_PRIMARY                Police principale
  BRAND_SECONDARY              Police secondaire
```
