# Insert Piles

Une page web qui génère des inserts de tiroir pour ranger des piles, prêts à
imprimer en 3D.

Tu donnes la taille de ton tiroir et le nombre de piles de chaque type. La page
calcule le rangement, montre le résultat en 2D et en 3D, et propose le
téléchargement en STL, 3MF ou `.scad`.

Tout le calcul se fait dans le navigateur : pas de serveur, pas de compte, rien
à installer.

## Ce que ça sait faire

- 38 types de piles : cylindriques (AA, AAA, C, D, 18650…), rectangulaires
  (9V, 4,5V plate) et piles bouton rangées sur la tranche.
- Plusieurs types dans un même insert, une zone par type.
- Trois façons d'utiliser l'espace restant du tiroir : rien, un bac pour les
  piles usagées, ou plus de piles d'un type choisi.
- Étiquettes en relief ou gravées, encoches pour attraper les piles.
- Avertissement si l'insert dépasse du plateau d'impression ou si une pile
  dépasse la hauteur du tiroir.
- Export 3MF en deux pièces (corps et étiquettes) pour imprimer en deux
  couleurs.

## Développement

Il faut Node 22 ou plus récent.

```bash
npm install        # installer les dépendances
npm run dev        # lancer la page en local
npm test           # tests unitaires et de géométrie (avec le vrai OpenSCAD)
npm run e2e        # tests dans un vrai navigateur, sur le build
npm run build      # construire le site dans dist/
```

Les tests de bout en bout ont besoin de Chromium : `npx playwright install chromium`.

La page `?diagnostic=1` vérifie que le moteur 3D tourne dans le navigateur
utilisé.

## Mettre la page sur un site

`npm run build` produit un dossier `dist/` de fichiers statiques. Copie son
contenu dans n'importe quel dossier d'un site web : les chemins sont relatifs,
la page fonctionne aussi dans un sous-dossier ou dans une iframe.

Le moteur 3D pèse environ 11 Mo. Il n'est téléchargé qu'une fois, puis gardé
en cache par le navigateur.

## Ajouter une pile

Ajoute une ligne dans `src/catalogue.ts`, avec ses dimensions en millimètres.
Rien d'autre ne change : le formulaire, le rangement et la géométrie suivent.

## Comment c'est fait

| Dossier | Rôle |
|---|---|
| `src/catalogue.ts` | La liste des piles |
| `src/placement/` | Calcule où va chaque zone (TypeScript pur, sans 3D) |
| `src/scad/` | Transforme le plan en fichier `.scad`, et la bibliothèque OpenSCAD qui dessine l'insert |
| `src/moteur/` | Fait tourner OpenSCAD (WebAssembly) dans un Web Worker |
| `src/export/` | Lecture STL, écriture 3MF, téléchargements |
| `src/apercu/` | Plan 2D (SVG) et aperçu 3D (Three.js) |
| `src/interface/` | Le formulaire et l'écran |

La conception détaillée est dans
[`docs/superpowers/specs/2026-11-13-insert-piles-design.md`](docs/superpowers/specs/2026-11-13-insert-piles-design.md).

## Licences

La géométrie est calculée par [OpenSCAD](https://github.com/openscad/openscad),
logiciel libre sous licence GPL, distribué ici sous forme WebAssembly par le
paquet `openscad-wasm-prebuilt`. Ses sources sont disponibles à l'adresse
ci-dessus.

Les étiquettes utilisent la police Arimo Bold (licence Apache 2.0).

La licence du code de ce projet n'est pas encore choisie.
