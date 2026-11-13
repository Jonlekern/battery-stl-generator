# Insert Piles : générateur d'inserts de tiroir pour piles

Spec de conception, validée en discussion le 13 novembre 2026.

## 1. But

Une page web publique qui génère des fichiers imprimables en 3D : des inserts
de tiroir qui rangent des piles. L'utilisateur donne la taille de son tiroir et
le nombre de piles de chaque type. La page calcule le rangement, montre le
résultat et propose le téléchargement en STL, 3MF ou `.scad`.

Rien à installer, aucun compte, aucun serveur : tout le calcul se fait dans le
navigateur.

**Réussite :** quelqu'un qui n'a jamais vu l'outil ouvre la page, entre son
tiroir et ses piles, télécharge un STL, l'imprime, et les piles rentrent dans
les alvéoles du premier coup avec le jeu par défaut.

## 2. Périmètre

### Dans la v1

- Inserts mixtes : plusieurs types de piles dans un même insert.
- Catalogue de toutes les piles courantes du commerce (section 5).
- Piles cylindriques et rectangulaires debout, piles bouton sur la tranche.
- Vérification que la demande rentre dans le tiroir.
- Trois façons de traiter l'espace restant : rien, zone « usagées », plus de
  piles.
- Étiquettes en relief ou gravées, encoches pour les doigts.
- Plan 2D instantané et aperçu 3D.
- Exports STL, 3MF multicolore et `.scad`.
- Interface en français, utilisable sur téléphone.

### Hors de la v1

- Découpage d'un insert plus grand que le plateau d'impression. La page
  affiche seulement un avertissement.
- Déplacement manuel des zones (glisser-déposer).
- Rangement en quinconce.
- Piles couchées.
- Couvercle, boîte fermée, base Gridfinity.
- Autres langues que le français.
- Lien de partage d'une configuration.

## 3. Parcours de l'utilisateur

1. Il entre la largeur et la profondeur intérieures du tiroir, et sa hauteur
   s'il veut les avertissements de hauteur.
2. Il choisit son imprimante dans une liste, ou entre la taille du plateau.
3. Il règle un compteur par type de pile.
4. Il choisit quoi faire de l'espace restant.
5. Le plan 2D se met à jour tout de suite. L'aperçu 3D suit après quelques
   secondes.
6. Il lit les avertissements éventuels, puis télécharge le fichier.

## 4. Architecture

Chaque module a un seul rôle et une interface claire.

| Module | Langage | Rôle | Dépend de |
|---|---|---|---|
| `catalogue` | données TypeScript | Liste des piles et de leurs dimensions | rien |
| `placement` | TypeScript, fonctions pures | Calcule les zones et les avertissements | `catalogue` |
| `scad` | TypeScript, fonctions pures | Transforme un plan en fichier `.scad` autonome | `placement` (types) |
| `insert_piles.scad` | OpenSCAD | Dessine la géométrie à partir de la liste de zones | rien |
| `moteur` | Web Worker + OpenSCAD WASM | Exécute un `.scad` et rend un maillage | `openscad-wasm-prebuilt` |
| `apercu` | SVG + Three.js | Plan 2D et vue 3D | `placement` (types) |
| `export` | TypeScript | Fabrique les fichiers STL, 3MF et `.scad` | `moteur`, `scad` |
| `interface` | Preact | Formulaire, messages, boutons | tous |

Trajet des données :

```
formulaire -> placement -> plan 2D (immédiat)
                        -> scad -> moteur -> maillages -> aperçu 3D
                                                       -> export
```

Le module `placement` ne fait aucune 3D. Le module `insert_piles.scad` ne fait
aucun calcul de placement : il reçoit des zones déjà positionnées. Cette
séparation permet de tester le placement sans OpenSCAD, et de garder le
fichier `.scad` lisible.

Stack : Vite, TypeScript, Preact, Three.js, `openscad-wasm-prebuilt`, Vitest,
Playwright.

### Types principaux

```ts
type Pile =
  | { id: string; nom: string; famille: 'cylindrique';
      diametre: number; hauteur: number }
  | { id: string; nom: string; famille: 'rectangulaire';
      longueur: number; largeur: number; hauteur: number }
  | { id: string; nom: string; famille: 'bouton';
      diametre: number; epaisseur: number };

interface Demande {
  tiroir: { largeur: number; profondeur: number; hauteur?: number };
  plateau: { largeur: number; profondeur: number };
  quantites: Record<string, number>;          // id de pile -> nombre
  reste:
    | { mode: 'rien' }
    | { mode: 'usagees' }
    | { mode: 'plus'; pileId: string };
  options: {
    jeu: number;              // mm, défaut 0,4
    fond: number;             // mm, défaut 2
    paroi: number;            // mm, défaut 1,2
    profondeurPct: number;    // défaut 40
    etiquettes: 'aucune' | 'relief' | 'grave';
    encoches: boolean;
  };
}

interface Zone {
  genre: 'piles' | 'usagees';
  pileId?: string;
  x: number; y: number;               // coin avant gauche, en mm
  largeur: number; profondeur: number; hauteur: number;
  colonnes: number; rangees: number;
  tournee: boolean;                   // cases tournées de 90°
  etiquette?: { texte: string; hauteurTexte: number };
}

type Plan =
  | { ok: true;
      insert: { largeur: number; profondeur: number; hauteur: number };
      zones: Zone[];
      avertissements: Avertissement[] }
  | { ok: false; erreurs: Erreur[] };
```

Toutes les dimensions sont en millimètres.

## 5. Catalogue

Dimensions nominales maximales. Elles seront vérifiées contre les fiches
techniques au moment de l'implémentation.

### Cylindriques (diamètre × hauteur)

| Pile | Dimensions |
|---|---|
| AAAA (LR61) | 8,3 × 42,5 |
| AAA (LR03) | 10,5 × 44,5 |
| AA (LR6) | 14,5 × 50,5 |
| C (LR14) | 26,2 × 50,0 |
| D (LR20) | 34,2 × 61,5 |
| N (LR1) | 12,0 × 30,2 |
| A23 (12 V) | 10,3 × 28,5 |
| A27 (12 V) | 8,0 × 28,2 |
| 4LR44 (6 V) | 13,0 × 25,2 |
| CR2 | 15,6 × 27,0 |
| CR123A | 17,0 × 34,5 |
| 14500 | 14,5 × 50,5 |
| 16340 | 17,0 × 34,5 |
| 18650 | 18,6 × 65,2 |
| 21700 | 21,7 × 70,9 |

### Rectangulaires (longueur × largeur × hauteur)

| Pile | Dimensions |
|---|---|
| 9V (6LR61) | 26,5 × 17,5 × 48,5 |
| 4,5V plate (3LR12) | 62,0 × 22,0 × 67,0 |

### Boutons (diamètre × épaisseur)

| Pile | Dimensions |
|---|---|
| CR2032 | 20,0 × 3,2 |
| CR2025 | 20,0 × 2,5 |
| CR2016 | 20,0 × 1,6 |
| CR2450 | 24,5 × 5,0 |
| CR2430 | 24,5 × 3,0 |
| CR1632 | 16,0 × 3,2 |
| CR1620 | 16,0 × 2,0 |
| CR1616 | 16,0 × 1,6 |
| CR1225 | 12,5 × 2,5 |
| CR1220 | 12,5 × 2,0 |
| LR44 (AG13, 357) | 11,6 × 5,4 |
| LR43 (AG12, 386) | 11,6 × 4,2 |
| LR1130 (AG10, 389) | 11,6 × 3,1 |
| LR41 (AG3, 392) | 7,9 × 3,6 |
| SR920SW (371) | 9,5 × 2,1 |
| SR626SW (377) | 6,8 × 2,6 |
| SR621SW (364) | 6,8 × 2,15 |
| Auditive 675 | 11,6 × 5,4 |
| Auditive 13 | 7,9 × 5,4 |
| Auditive 312 | 7,9 × 3,6 |
| Auditive 10 | 5,8 × 3,6 |

Ajouter une pile revient à ajouter une entrée dans le fichier du catalogue.
Aucun autre code ne change.

## 6. Placement

### Taille d'une case

| Famille | Pas en X | Pas en Y |
|---|---|---|
| Cylindrique | diamètre + jeu + paroi | identique |
| Rectangulaire | longueur + jeu + paroi | largeur + jeu + paroi |
| Bouton | diamètre + jeu + paroi | épaisseur + jeu + paroi |

Les cases rectangulaires et les fentes de piles bouton peuvent être tournées
de 90°. Les piles bouton d'une même rangée sont parallèles entre elles, comme
dans un monnayeur.

### Taille d'une zone

- Largeur = colonnes × pas X + paroi.
- Profondeur = rangées × pas Y + paroi, plus une bande de 8 mm à l'avant si
  les étiquettes sont activées.
- Hauteur = fond + profondeur d'alvéole (section 7).

Une zone contient toujours une grille complète. Pour 7 piles demandées, une
grille 4 × 2 donne 8 alvéoles. La page affiche le nombre réel d'alvéoles.

### Algorithme

1. Surface utile = tiroir moins 1 mm de jeu sur chaque dimension.
2. Pour chaque type demandé, lister les formes de grille possibles
   (colonnes × rangées, dans les deux orientations) qui tiennent dans la
   surface utile. Si les étiquettes sont activées et qu'au moins une forme est
   assez large pour porter la sienne, seules ces formes sont gardées.
3. Ranger les zones en rangées dans le tiroir. Essayer plusieurs combinaisons
   de formes et garder la disposition valide dont le rectangle englobant a le
   plus petit demi-périmètre (largeur + profondeur). Ce critère favorise les
   formes proches du carré : 12 AA donnent une grille 4 × 3, pas une bande
   1 × 12.
4. Traiter l'espace restant selon le mode choisi.

L'algorithme est déterministe : la même demande donne toujours le même plan.

### Espace restant

- **`rien`** : l'insert a la taille du rectangle englobant des zones.
- **`usagees`** : l'insert a la taille de la surface utile. Le plus grand
  rectangle libre devient un bac ouvert, s'il fait au moins 40 × 40 mm. Sinon
  la page affiche un avertissement.
- **`plus`** : l'insert a la taille de la surface utile. Chaque rectangle
  libre reçoit la plus grande grille possible du type choisi.

Dans tous les modes, une plaque de l'épaisseur du fond couvre toute la surface
de l'insert. L'insert est donc toujours un rectangle plein, même si les zones
ne le remplissent pas entièrement.

### Erreurs bloquantes

- La demande ne rentre pas : le message liste les types qui ne passent pas.
- Saisie hors limites : tiroir entre 30 et 1000 mm par côté, hauteur entre 10
  et 500 mm, quantité entre 0 et 500 par type, au moins une pile demandée
  (sauf en mode `plus`, qui peut remplir un tiroir à lui seul).

### Avertissements non bloquants

- L'insert ne tient sur le plateau dans aucune des deux orientations.
- Une pile debout dépasse la hauteur du tiroir (fond + hauteur de la pile, ou
  fond + diamètre pour une pile bouton).
- Une étiquette est omise parce que la zone est trop étroite (texte de moins
  de 4 mm de haut).
- Pas assez de place pour la zone « usagées ».

## 7. Géométrie

### Plaque

- Fond : 2 mm. Paroi minimale entre deux alvéoles : 1,2 mm.
- Hauteur en escalier : chaque zone a sa propre hauteur.
- Dessous plat, aucune partie en surplomb : impression sans supports.

### Alvéoles

| Famille | Forme | Profondeur |
|---|---|---|
| Cylindrique | Trou rond | `profondeurPct` % de la hauteur de la pile |
| Rectangulaire | Poche à coins arrondis | `profondeurPct` % de la hauteur |
| Bouton | Fente à fond arrondi, largeur = épaisseur + jeu | 55 % du diamètre |

- Le jeu s'ajoute au diamètre, ou à chaque côté pour les rectangulaires.
- Chanfrein en haut des alvéoles cylindriques et rectangulaires. Il vaut
  0,6 mm au maximum et un quart de la paroi au plus, pour ne pas réduire la
  paroi à une arête. Les fentes de piles bouton n'ont pas de chanfrein.
- `profondeurPct` vaut 40 par défaut et se règle entre 20 et 80. La
  profondeur des fentes de piles bouton est fixe.

### Encoches pour les doigts

- Piles bouton : de chaque côté de la rangée, le bloc est abaissé à 30 % du
  diamètre sur le quart extérieur de la fente. Les bords de la pile sont ainsi
  dégagés pour la pincer.
- Rectangulaires : une encoche demi-cylindrique de 7 mm de rayon, centrée sur
  chaque petit côté de la poche, profonde de la moitié de l'alvéole.
- Les découpes d'une zone ne débordent jamais sur la zone voisine, ni sur sa
  propre bande d'étiquette.
- Cylindriques : aucune encoche.

### Étiquettes

- Texte = nom court de la pile (« AA », « CR2032 »), sur la bande avant de la
  zone.
- Police : Liberation Sans Bold, fournie avec OpenSCAD sur PC. Dans le
  navigateur, c'est Arimo Bold qui la remplace : même dessin, licence libre.
- Relief : +0,6 mm au-dessus de la surface. Gravé : −0,6 mm.
- La taille du texte s'adapte à la largeur de la zone, avec un maximum de
  6 mm de haut.

### Zone « usagées »

- Bac ouvert, parois de 1,6 mm, hauteur égale à celle de la zone la plus
  haute.
- Étiquette « USAGÉES » sur le fond du bac, à l'avant.

### Format du `.scad` généré

Le fichier contient les paramètres, la liste des zones, puis le contenu de
`insert_piles.scad`. Il s'ouvre tel quel dans OpenSCAD sur PC.

```scad
piece = "tout";   // "corps", "etiquettes" ou "tout"
fond = 2; jeu = 0.4; paroi = 1.2;
zones = [ /* une entrée par zone */ ];
// ... modules de insert_piles.scad ...
```

- `corps` : la plaque avec ses alvéoles. En mode gravé, le texte est soustrait.
- `etiquettes` : le texte seul. En mode gravé, c'est le volume qui remplit la
  gravure.
- `tout` : l'union des deux en mode relief, le corps seul en mode gravé.

## 8. Exports

| Format | Contenu |
|---|---|
| STL binaire | La pièce `tout` |
| 3MF | Un objet composé de deux pièces, `corps` et `etiquettes`. L'utilisateur attribue une couleur à chaque pièce dans son slicer. |
| `.scad` | Le fichier autonome décrit ci-dessus |

Nom de fichier : `insert-piles-<largeur>x<profondeur>.<extension>`, avec les
dimensions de l'insert arrondies au millimètre.

Le 3MF est assemblé en TypeScript (archive zip + XML) à partir des deux
maillages rendus par le moteur. Sans étiquettes, il contient une seule pièce.

## 9. Interface

Deux colonnes sur grand écran, une seule sur téléphone.

**Colonne des réglages**

1. Tiroir : largeur, profondeur, hauteur (optionnelle).
2. Imprimante : préréglages (Bambu A1 mini 180 × 180, Bambu A1 / P1 / X1
   256 × 256, Prusa MK4 250 × 210, Prusa Mini 180 × 180, Ender 3 220 × 220)
   ou taille personnalisée.
3. Piles : un compteur par type, regroupés par famille.
4. Reste du tiroir : rien, zone « usagées », plus de piles (avec le type).
5. Options : étiquettes (aucune, relief, gravé), encoches.
6. Réglages avancés, repliés : jeu, fond, paroi, profondeur d'alvéole.

**Colonne du résultat**

- Erreurs et avertissements.
- Résumé : dimensions de l'insert et nombre d'alvéoles.
- Boutons de téléchargement : STL, 3MF, `.scad`.
- Aperçu 3D (Three.js), corps en gris et étiquettes en couleur, avec un
  indicateur pendant le calcul.
- Plan 2D (SVG), mis à jour à chaque changement.

Sur grand écran, cette colonne reste visible pendant qu'on règle. Sur
téléphone, elle se trouve sous les réglages : un bandeau fixé en bas de
l'écran résume le résultat et y conduit.

Le recalcul 3D part 500 ms après le dernier changement. Un calcul devenu
inutile est abandonné. Les derniers réglages sont mémorisés dans le
navigateur (`localStorage`).

## 10. Gestion des erreurs

| Situation | Comportement |
|---|---|
| La demande ne rentre pas | Message bloquant, pas de calcul 3D, téléchargements désactivés |
| Saisie hors limites | Champ marqué en erreur, valeur refusée |
| Le moteur ne se charge pas | Message clair. Le plan 2D et le téléchargement du `.scad` restent disponibles |
| Le calcul 3D échoue | Le dernier modèle valide reste affiché, avec le message d'erreur |
| Avertissements | Affichés, sans bloquer |

## 11. Tests

- **Catalogue** : dimensions positives, identifiants uniques.
- **Placement** : aucune zone ne chevauche une autre, tout reste dans la
  surface utile, chaque type a au moins le nombre d'alvéoles demandé, les
  demandes impossibles rendent une erreur, les trois modes de reste donnent
  la bonne taille d'insert, chaque avertissement se déclenche dans son cas.
- **Générateur `.scad`** : le fichier produit contient les bonnes zones et les
  bons paramètres.
- **Géométrie** : le vrai OpenSCAD (WASM, sous Node) tourne sur quelques
  demandes types. On vérifie que le maillage est fermé, que sa boîte
  englobante correspond au plan, et que son volume est inférieur à celui du
  bloc plein.
- **Export** : le STL et le 3MF produits se relisent correctement.
- **Bout en bout** (Playwright) : ouvrir la page, remplir le formulaire,
  attendre la 3D, télécharger le STL et vérifier qu'il n'est pas vide.

Les tests et le build tournent à chaque push (GitHub Actions).

## 12. Hébergement

- Le build produit un dossier de fichiers statiques, avec des chemins
  relatifs. Il fonctionne dans n'importe quel sous-dossier, ou dans une
  iframe.
- Pendant le développement : publication de test sur GitHub Pages.
- Version finale : le dossier est déposé sur le site de Johnny.

## 13. Hypothèses techniques

Vérifiées le 13 novembre 2026 par un essai sous Node :

1. **Moteur** : `openscad-wasm-prebuilt` 1.2.0 (11 Mo) fonctionne, avec le
   rendu rapide Manifold. Le paquet `openscad-wasm` 0.0.4 est écarté : il
   plante dès qu'une police est chargée. Chaque rendu demande une instance
   neuve du moteur.
2. **Polices** : `text()` fonctionne avec Arimo Bold déclarée sous le nom
   « Liberation Sans », y compris le « É » de « USAGÉES ».
3. **Performance** : 825 alvéoles dans une plaque de 400 × 300 mm se calculent
   en 3,4 secondes.

4. **Navigateur** : le moteur tourne dans un Web Worker, sur le build de
   production (vérifié sous Chromium par un test automatique).

Restent à vérifier :

5. **3MF** : l'import en deux pièces dans Bambu Studio et PrusaSlicer. Ce test
   est manuel et revient à Johnny.
6. **Licence** : OpenSCAD est sous licence GPL. La page doit le mentionner et
   donner un lien vers ses sources. La licence du projet lui-même reste à
   choisir.

## 14. Évolutions possibles

Découpage automatique des grands inserts, déplacement manuel des zones,
rangement en quinconce, piles couchées, base Gridfinity, autres langues, lien
de partage.
