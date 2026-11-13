# Insert Piles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page web statique qui génère des inserts de tiroir pour piles (STL, 3MF, `.scad`) à partir de la taille du tiroir et des quantités de piles.

**Architecture:** Le placement des zones est calculé en TypeScript pur. Un générateur produit un fichier `.scad` autonome, rendu par OpenSCAD (WASM) dans un Web Worker. L'interface Preact affiche un plan 2D immédiat, puis l'aperçu 3D.

**Tech Stack:** Vite 8, TypeScript 7, Preact 11, Three.js, `openscad-wasm-prebuilt` 1.2.0, `@expo-google-fonts/arimo`, fflate, Vitest 5, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-13-insert-piles-design.md`

## Global Constraints

- Toutes les dimensions sont en millimètres.
- Interface en français. Les identifiants du code sont en français, comme dans la spec.
- Aucun serveur : le build est un dossier statique, `base: './'` dans Vite.
- `calculerPlan` est déterministe : même demande, même plan.
- OpenSCAD : `openscad-wasm-prebuilt@1.2.0` exactement. Une instance neuve par rendu. Arguments `--backend=manifold --export-format=binstl`.
- `$fn = 48` dans le `.scad`.
- Police : `font="Liberation Sans:style=Bold"` dans le `.scad`. Le moteur charge Arimo Bold et la déclare sous ce nom.
- `@playwright/test` en version 1.63.0 exactement (celle du Chromium préinstallé). Ne pas lancer `playwright install` en local. Lancer les tests avec `--trace off`.
- Branche de travail : `dev`. Rien n'est poussé sur `main` sans l'accord de Johnny. La publication GitHub Pages part de `main`.
- Messages de commit en anglais, un commit par tâche au minimum.

## Review Focus

Entrées que la spec implique sans les nommer. Chacune a son test dans la tâche indiquée.

1. **Saisie à la française ou vide** : « 0,4 », champ vide, texte. Attendu : « 0,4 » vaut 0,4 ; le reste marque le champ en erreur, sans plan rempli de `NaN`. Tâches 6 et 11.
2. **Tiroir plus petit qu'une seule alvéole** : pile D dans un tiroir de 30 × 30. Attendu : erreur `ne_rentre_pas` qui nomme la pile, sans plantage ni boucle. Tâches 5 et 6.
3. **Aucune étiquette à rendre** : toutes les zones sont trop étroites. Attendu : le rendu réussit, le 3MF contient une seule pièce. Tâches 8 et 11.
4. **Réglages mémorisés invalides** : JSON corrompu, ancienne version, pile inconnue. Attendu : retour aux réglages par défaut, sans plantage. Tâche 11.
5. **Réglages changés pendant un calcul 3D** : attendu : l'aperçu montre le dernier réglage, jamais un calcul plus ancien arrivé en retard. Tâche 11.

## Faits vérifiés

Essai sous Node 22 le 13 novembre 2026.

- `openscad-wasm-prebuilt@1.2.0` expose `createOpenSCAD({ print, printErr })`, puis `getInstance()` avec `FS` et `callMain(args)`. Le WASM est inclus dans le fichier JS (11 Mo).
- Un second `callMain` sur la même instance lève une exception. Il faut une instance par rendu (création : environ 110 ms).
- Une erreur de syntaxe rend le code 1 et une ligne `ERROR: Parser error` sur la sortie.
- Un objet vide (par exemple la pièce `etiquettes` sans aucun texte) est une erreur pour OpenSCAD : ne jamais la demander.
- 825 alvéoles dans 400 × 300 mm : 3,4 s, STL binaire de 7,9 Mo.
- `openscad-wasm@0.0.4` plante dès qu'une police est présente : ne pas l'utiliser.

## Structure des fichiers

```
index.html, package.json, tsconfig.json, vite.config.ts, playwright.config.ts
.github/workflows/ci.yml
src/
  types.ts                  Types partagés, valeurs par défaut, limites, constantes
  catalogue.ts              Liste des piles
  placement/cases.ts        Pas des cases, hauteur des zones, formes de grille
  placement/rangement.ts    Rangement des zones en rangées
  placement/reste.ts        Rectangles libres, modes « usagees » et « plus »
  placement/index.ts        calculerPlan : validation, orchestration, avertissements
  scad/insert_piles.scad    Bibliothèque OpenSCAD
  scad/generer.ts           Plan -> texte .scad
  moteur/openscad.ts        Rendu d'un .scad (Node et Worker)
  moteur/worker.ts          Web Worker
  moteur/client.ts          Accès au Worker depuis la page, annulation
  export/stl.ts             Lecture STL, boîte englobante, volume, maillage fermé
  export/troismf.ts         Écriture 3MF
  export/fichiers.ts        Noms de fichiers, téléchargement
  apercu/Plan2D.tsx         Plan SVG
  apercu/Vue3D.tsx          Vue Three.js
  interface/                App, Formulaire, Messages, etat, messages, saisie,
                            calcul3d, imprimantes
  main.tsx, style.css
tests/                      Même arborescence que src/, plus tests/aide/
e2e/                        Tests Playwright
```

---

### Task 1: Socle, types et catalogue

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/vite-env.d.ts`, `src/types.ts`, `src/catalogue.ts`
- Test: `tests/catalogue.test.ts`

**Interfaces:**
- Produces: tout le contenu de `src/types.ts` ci-dessous, `PILES: Pile[]`, `pileParId(id: string): Pile | undefined`.

- [ ] **Step 1: Créer la branche `dev` et le socle**

`git checkout -b dev`. Scripts npm : `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`), `e2e` (`playwright test --trace off`). Vite : `base: './'`, `worker: { format: 'es' }`, preset Preact, Vitest en environnement `node` sur `tests/**/*.test.{ts,tsx}`. `src/main.tsx` affiche le titre « Insert Piles ». `.gitignore` : `node_modules`, `dist`, `test-results`, `playwright-report`.

- [ ] **Step 2: Écrire `src/types.ts`**

```ts
export type Famille = 'cylindrique' | 'rectangulaire' | 'bouton';
interface PileBase { id: string; nom: string; libelle: string }
export type Pile =
  | (PileBase & { famille: 'cylindrique'; diametre: number; hauteur: number })
  | (PileBase & { famille: 'rectangulaire'; longueur: number; largeur: number; hauteur: number })
  | (PileBase & { famille: 'bouton'; diametre: number; epaisseur: number });

export type Piece = 'corps' | 'etiquettes' | 'tout';
export interface Options {
  jeu: number; fond: number; paroi: number; profondeurPct: number;
  etiquettes: 'aucune' | 'relief' | 'grave'; encoches: boolean;
}
export interface Demande {
  tiroir: { largeur: number; profondeur: number; hauteur?: number };
  plateau: { largeur: number; profondeur: number };
  quantites: Record<string, number>;
  reste: { mode: 'rien' } | { mode: 'usagees' } | { mode: 'plus'; pileId: string };
  options: Options;
}
export interface Zone {
  genre: 'piles' | 'usagees';
  pileId?: string;
  x: number; y: number; largeur: number; profondeur: number; hauteur: number;
  colonnes: number; rangees: number; tournee: boolean;
  etiquette?: { texte: string; hauteurTexte: number };
}
export type Avertissement =
  | { code: 'plateau' }
  | { code: 'hauteur'; pileId: string; hauteurTotale: number }
  | { code: 'etiquette_omise'; pileId: string }
  | { code: 'usagees_impossible' };
export type Erreur =
  | { code: 'ne_rentre_pas'; pileIds: string[] }
  | { code: 'saisie'; champ: string }
  | { code: 'aucune_pile' };
export type Plan =
  | { ok: true; insert: { largeur: number; profondeur: number; hauteur: number };
      zones: Zone[]; avertissements: Avertissement[] }
  | { ok: false; erreurs: Erreur[] };
export type PlanOk = Extract<Plan, { ok: true }>;

export const OPTIONS_DEFAUT: Options =
  { jeu: 0.4, fond: 2, paroi: 1.2, profondeurPct: 40, etiquettes: 'relief', encoches: true };
export const LIMITES = {
  tiroirCote: [30, 1000], tiroirHauteur: [10, 500], plateauCote: [50, 1000],
  quantite: [0, 500], jeu: [0, 2], fond: [1, 10], paroi: [0.8, 5], profondeurPct: [20, 80],
} as const;
export const C = {
  JEU_TIROIR: 1, BANDE: 8, TEXTE_MAX: 6, TEXTE_MIN: 4, FACTEUR_TEXTE: 1.05, MARGE_TEXTE: 2,
  PROF_BOUTON_PCT: 55, ENCOCHE_BOUTON_PCT: 30, ENCOCHE_RECT_RAYON: 7, RELIEF: 0.6,
  CHANFREIN_MAX: 0.6, RAYON_COIN_RECT: 2, PAROI_BAC: 1.6, BAC_MIN: 40, FN: 48,
} as const;
```

`nom` est le texte de l'étiquette (« AA », « 4,5V », « 675 »). `libelle` est le texte du formulaire (« AA (LR6) », « Auditive 675 »).

- [ ] **Step 3: Écrire le test du catalogue**

`tests/catalogue.test.ts` :
- `PILES` contient 38 piles : 15 cylindriques, 2 rectangulaires, 21 boutons.
- Les `id` sont uniques, en minuscules, sans espace.
- Toutes les dimensions sont strictement positives. Tous les `nom` font 7 caractères au plus.
- `pileParId('aa')` : diamètre 14.5, hauteur 50.5. `pileParId('9v')` : 26.5 × 17.5 × 48.5. `pileParId('cr2032')` : diamètre 20, épaisseur 3.2. `pileParId('inconnue')` : `undefined`.

- [ ] **Step 4: Lancer le test, vérifier qu'il échoue**

Run: `npm test` — Expected: FAIL, `catalogue` introuvable.

- [ ] **Step 5: Écrire `src/catalogue.ts`**

Les 38 piles de la section 5 de la spec, dans l'ordre de la spec. Identifiants : `aaaa, aaa, aa, c, d, n, a23, a27, 4lr44, cr2, cr123a, 14500, 16340, 18650, 21700, 9v, 4v5, cr2032, cr2025, cr2016, cr2450, cr2430, cr1632, cr1620, cr1616, cr1225, cr1220, lr44, lr43, lr1130, lr41, sr920sw, sr626sw, sr621sw, aud675, aud13, aud312, aud10`.

- [ ] **Step 6: Vérifier**

Run: `npm test && npm run build` — Expected: tests PASS, dossier `dist/` créé.

- [ ] **Step 7: Commit**

`git add -A && git commit -m "feat: project scaffold, shared types and battery catalogue"`

---

### Task 2: Moteur OpenSCAD sous Node et lecture STL

**Files:**
- Create: `src/moteur/openscad.ts`, `src/export/stl.ts`, `tests/aide/police.ts`
- Test: `tests/moteur/openscad.test.ts`, `tests/export/stl.test.ts`

**Interfaces:**
- Consumes: `Piece` (tâche 1).
- Produces:
  - `rendre(scad: string, piece: Piece, police: Uint8Array): Promise<Uint8Array>` (STL binaire)
  - `class ErreurOpenScad extends Error { journal: string[] }`
  - `interface Maillage { positions: Float32Array }` (9 nombres par triangle)
  - `lireStl(octets: Uint8Array): Maillage`
  - `boiteEnglobante(m: Maillage): { min: [number, number, number]; max: [number, number, number] }`
  - `volume(m: Maillage): number`, `estFerme(m: Maillage): boolean`, `nombreTriangles(m: Maillage): number`
  - `tests/aide/police.ts` : `chargerPolice(): Uint8Array`, lit `node_modules/@expo-google-fonts/arimo/700Bold/Arimo_700Bold.ttf`.

- [ ] **Step 1: Écrire les tests STL**

`tests/export/stl.test.ts`, sur un STL binaire d'un seul triangle fabriqué à la main : `nombreTriangles` vaut 1, `boiteEnglobante` donne les bons coins, `estFerme` vaut `false`. `lireStl` sur moins de 84 octets lève une erreur.

- [ ] **Step 2: Écrire les tests du moteur**

`tests/moteur/openscad.test.ts` (délai de 60 s par test) :
- `cube(10);` : 12 triangles, boîte de `[0,0,0]` à `[10,10,10]`, volume 1000 à 0,01 près, `estFerme` vrai.
- `piece="tout"; if (piece=="corps") cube(5); else cube(10);` rendu avec `'corps'` : la boîte monte à 5.
- `linear_extrude(1) text("É", size=6, font="Liberation Sans:style=Bold");` donne plus de triangles que le même code avec `"E"`.
- `cube(5` rejette avec `ErreurOpenScad` dont le `journal` contient une ligne `Parser error`.
- Deux rendus à la suite réussissent.

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `npm test` — Expected: FAIL, modules introuvables.

- [ ] **Step 4: Écrire `src/export/stl.ts`**

`volume` : somme des volumes signés des tétraèdres. `estFerme` : chaque arête appartient à exactement deux triangles, après fusion des sommets arrondis à 1e-4.

- [ ] **Step 5: Écrire `src/moteur/openscad.ts`**

La recette est vérifiée, la reprendre telle quelle :

```ts
import { createOpenSCAD } from 'openscad-wasm-prebuilt';
const CONF = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
<dir>/fonts</dir>
<alias binding="same"><family>Liberation Sans</family><prefer><family>Arimo</family></prefer></alias>
</fontconfig>
`;
export async function rendre(scad: string, piece: Piece, police: Uint8Array): Promise<Uint8Array> {
  const journal: string[] = [];
  const o = await createOpenSCAD({ print: t => journal.push(t), printErr: t => journal.push(t) });
  const inst = o.getInstance();
  inst.FS.mkdir('/fonts');
  inst.FS.writeFile('/fonts/Arimo-Bold.ttf', police);
  inst.FS.writeFile('/fonts/fonts.conf', CONF);
  inst.FS.writeFile('/in.scad', scad);
  let code: number;
  try {
    code = inst.callMain(['/in.scad', '--backend=manifold', '--export-format=binstl',
      '-D', `piece="${piece}"`, '-o', '/out.stl']);
  } catch (e) { throw new ErreurOpenScad(String(e), journal); }
  if (code !== 0) throw new ErreurOpenScad(`OpenSCAD a rendu le code ${code}`, journal);
  return inst.FS.readFile('/out.stl', { encoding: 'binary' });
}
```

- [ ] **Step 6: Vérifier**

Run: `npm test` — Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -m "feat: OpenSCAD engine wrapper and STL reader"`

---

### Task 3: Moteur dans le navigateur

Cette tâche lève la dernière hypothèse technique de la spec (section 13, point 4). Si elle échoue, arrêter et prévenir Johnny avant d'aller plus loin.

**Files:**
- Create: `src/moteur/worker.ts`, `src/moteur/client.ts`, `playwright.config.ts`, `e2e/moteur.spec.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `rendre`, `ErreurOpenScad`, `lireStl`, `nombreTriangles` (tâche 2).
- Produces:
  - `interface Moteur { rendre(scad: string, piece: Piece): Promise<Uint8Array>; annuler(): void }`
  - `creerMoteur(): Moteur`
  - `class ErreurAnnulee extends Error`
  - Page de diagnostic : `?diagnostic=1` rend `cube(10);` et écrit le nombre de triangles dans `[data-testid="diag-triangles"]`, ou le message d'erreur dans `[data-testid="diag-erreur"]`.

- [ ] **Step 1: Écrire le test Playwright**

`e2e/moteur.spec.ts` : ouvrir `./?diagnostic=1`, attendre que `[data-testid="diag-triangles"]` contienne `12` (délai 90 s). Vérifier qu'aucune erreur n'est sortie dans la console.

`playwright.config.ts` : `webServer` lance `npm run build && npm run preview -- --port 4173 --strictPort`, `baseURL` `http://localhost:4173/`, projet Chromium seul, `trace: 'off'`. Le test tourne donc sur le vrai build.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npm run e2e` — Expected: FAIL, élément absent.

- [ ] **Step 3: Écrire le Worker et le client**

`worker.ts` charge la police une fois avec `fetch` sur l'URL importée par `import urlPolice from '@expo-google-fonts/arimo/700Bold/Arimo_700Bold.ttf?url'`. Messages : `{ id, scad, piece }` vers le Worker, `{ id, ok: true, stl }` ou `{ id, ok: false, message, journal }` en retour. Le tampon du STL est transféré, pas copié.

`client.ts` crée le Worker avec `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`. `annuler()` termine le Worker, rejette les demandes en attente avec `ErreurAnnulee`, et le prochain `rendre` en crée un nouveau.

- [ ] **Step 4: Ajouter la page de diagnostic dans `src/main.tsx`**

- [ ] **Step 5: Vérifier**

Run: `npm run e2e` — Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: run OpenSCAD in a web worker, with a diagnostic page"`

---

### Task 4: Cases et formes de grille

**Files:**
- Create: `src/placement/cases.ts`
- Test: `tests/placement/cases.test.ts`

**Interfaces:**
- Consumes: `Pile`, `Options`, `C` (tâche 1).
- Produces:
  - `interface Case { pasX: number; pasY: number; profondeurAlveole: number; hauteurZone: number; hauteurDebout: number }`
  - `caseDe(pile: Pile, o: Options, tournee: boolean): Case`
  - `interface Forme { colonnes: number; rangees: number; tournee: boolean; largeur: number; profondeur: number }`
  - `formesPossibles(pile: Pile, quantite: number, o: Options, utile: { largeur: number; profondeur: number }): Forme[]`
  - `hauteurTexte(texte: string, largeurDispo: number): number | null`

Règles :
- Pas : cylindrique `d + jeu + paroi` dans les deux sens. Rectangulaire `longueur + jeu + paroi` en X et `largeur + jeu + paroi` en Y. Bouton `diamètre + jeu + paroi` en X et `épaisseur + jeu + paroi` en Y. `tournee` échange X et Y.
- `profondeurAlveole` : `profondeurPct` % de la hauteur, ou 55 % du diamètre pour un bouton. `hauteurZone = fond + profondeurAlveole`. `hauteurDebout` : hauteur de la pile, ou diamètre pour un bouton.
- Zone : `largeur = colonnes × pasX + paroi`, `profondeur = rangees × pasY + paroi + bande`, avec `bande = 8` sauf si `etiquettes` vaut `'aucune'`.
- `formesPossibles` : pour `colonnes` de 1 à `quantite`, `rangees = ceil(quantite / colonnes)`. Ne garder que le plus petit `colonnes` pour chaque valeur de `rangees`. Les deux orientations, sauf pour les cylindriques. Ne garder que les formes qui tiennent dans `utile`. Ordre : non tournées d'abord, puis `colonnes` croissant.
- `hauteurTexte` : `min(6, (largeurDispo − 2) / (1.05 × nombre de caractères))`, ou `null` si le résultat est sous 4.

- [ ] **Step 1: Écrire les tests**

Avec `OPTIONS_DEFAUT` :
- `caseDe(aa, o, false)` : `pasX` 16.1, `pasY` 16.1, `profondeurAlveole` 20.2, `hauteurZone` 22.2, `hauteurDebout` 50.5.
- `caseDe(9v, o, false)` : `pasX` 28.1, `pasY` 19.1, `hauteurZone` 21.4. Avec `tournee` : `pasX` 19.1, `pasY` 28.1.
- `caseDe(cr2032, o, false)` : `pasX` 21.6, `pasY` 4.8, `profondeurAlveole` 11, `hauteurZone` 13, `hauteurDebout` 20.
- `formesPossibles(aa, 12, o, {299, 399})` : 6 formes, `colonnes × rangees` = 1×12, 2×6, 3×4, 4×3, 6×2, 12×1. La forme 4×3 mesure 65.6 × 57.5.
- `formesPossibles(aa, 7, o, {299, 399})` : 5 formes (1×7, 2×4, 3×3, 4×2, 7×1).
- `formesPossibles(aa, 12, {...o, etiquettes: 'aucune'}, ...)` : la forme 4×3 mesure 65.6 × 49.5.
- `formesPossibles(9v, 2, o, {299, 399})` contient des formes tournées et non tournées.
- `formesPossibles(d, 1, o, {29, 29})` : tableau vide.
- `hauteurTexte('AA', 65.6)` : 6. `hauteurTexte('CR2032', 22.8)` : `null`. `hauteurTexte('CR2032', 40)` : 6. `hauteurTexte('CR2032', 30)` : 4.44 à 0,01 près.

Comparer les nombres avec `toBeCloseTo`.

- [ ] **Step 2: Lancer, vérifier l'échec** — Run: `npm test` — Expected: FAIL.
- [ ] **Step 3: Écrire `src/placement/cases.ts`**
- [ ] **Step 4: Vérifier** — Run: `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: cell pitch, zone height and grid shapes"`

---

### Task 5: Rangement en rangées

**Files:**
- Create: `src/placement/rangement.ts`
- Test: `tests/placement/rangement.test.ts`

**Interfaces:**
- Consumes: `Forme` (tâche 4).
- Produces:
  - `interface Candidat { pileId: string; formes: Forme[] }`
  - `interface Placee { pileId: string; forme: Forme; x: number; y: number }`
  - `interface Etagere { y: number; profondeur: number; xFin: number }`
  - `type Rangement = { ok: true; placees: Placee[]; etageres: Etagere[]; largeur: number; profondeur: number } | { ok: false; nonPlaces: string[] }`
  - `ranger(candidats: Candidat[], utile: { largeur: number; profondeur: number }): Rangement`

Algorithme :
1. Trier les candidats par `pileId`. Un candidat sans forme rend l'essai impossible et va dans `nonPlaces`.
2. Cibles `T` : toutes les valeurs distinctes de `profondeur` parmi les formes, en ordre croissant. S'il y en a plus de 60, en garder 60 réparties régulièrement, dont la plus petite et la plus grande.
3. Pour chaque `T`, choisir pour chaque candidat la forme de `profondeur ≤ T` la moins large. S'il n'y en a aucune, prendre sa forme la moins profonde.
4. Ranger ces formes par `profondeur` décroissante, puis `pileId`. Les poser de gauche à droite. Ouvrir une nouvelle étagère quand la largeur utile est dépassée. Une forme qui dépasse la profondeur utile n'est pas placée.
5. Parmi les essais où tout est placé, garder celui qui minimise `largeur + profondeur` du rectangle englobant. En cas d'égalité : la plus petite `profondeur`, puis le plus petit `T`.
6. Si aucun essai ne place tout, rendre `nonPlaces` de l'essai qui en laisse le moins. En cas d'égalité, le plus petit `T`.

- [ ] **Step 1: Écrire les tests**

- Un candidat AA × 12 dans 299 × 399 : forme 4×3 en `(0, 0)`, `largeur` 65.6, `profondeur` 57.5, une étagère.
- AA × 8, AAA × 8, 9V × 2, CR2032 × 6 dans 299 × 399 : `ok`, aucune zone n'en chevauche une autre, toutes sont dans `utile`.
- Le même appel deux fois rend des résultats égaux. Inverser l'ordre des candidats ne change pas le résultat.
- Pile D dans 29 × 29 : `{ ok: false, nonPlaces: ['d'] }`.
- AA × 500 dans 99 × 99 : `{ ok: false, nonPlaces: ['aa'] }`.
- 38 candidats de 500 piles chacun dans 999 × 999 : la fonction répond en moins d'une seconde.

- [ ] **Step 2: Lancer, vérifier l'échec** — Run: `npm test` — Expected: FAIL.
- [ ] **Step 3: Écrire `src/placement/rangement.ts`**
- [ ] **Step 4: Vérifier** — Run: `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: shelf packing of battery zones"`

---

### Task 6: Plan complet

**Files:**
- Create: `src/placement/reste.ts`, `src/placement/index.ts`, `tests/aide/invariants.ts`
- Test: `tests/placement/plan.test.ts`

**Interfaces:**
- Consumes: `caseDe`, `formesPossibles`, `hauteurTexte` (tâche 4), `ranger`, `Etagere` (tâche 5), `pileParId` (tâche 1).
- Produces:
  - `calculerPlan(d: Demande): Plan`
  - `nombreAlveoles(z: Zone): number` (`colonnes × rangees`)
  - `interface Rect { x: number; y: number; largeur: number; profondeur: number }`
  - `rectanglesLibres(etageres: Etagere[], utile: { largeur: number; profondeur: number }): Rect[]`
  - `tests/aide/invariants.ts` : `verifierInvariants(plan: PlanOk, d: Demande): void`

Règles :
- **Validation**, avant tout calcul. Chaque nombre doit être fini et dans `LIMITES`. Les quantités sont entières. Une quantité non nulle sur un `id` inconnu est une erreur. Le `pileId` du mode `plus` doit exister. Champs : `tiroir.largeur`, `tiroir.profondeur`, `tiroir.hauteur`, `plateau.largeur`, `plateau.profondeur`, `quantites.<id>`, `reste.pileId`, `options.jeu`, `options.fond`, `options.paroi`, `options.profondeurPct`. Toutes les erreurs de saisie sont rendues ensemble.
- `aucune_pile` si toutes les quantités sont nulles et que le mode n'est pas `plus`.
- `utile = tiroir − 1` sur chaque côté.
- Zones : `x`, `y` relatifs au coin avant gauche de l'insert. `etiquette` présente si `options.etiquettes` n'est pas `'aucune'` et si `hauteurTexte(nom, largeur)` n'est pas `null`. Sinon, avertissement `etiquette_omise`, une fois par type.
- `rectanglesLibres` : à droite de chaque étagère (`x = xFin`, hauteur de l'étagère), plus la bande sous la dernière étagère sur toute la largeur. Ignorer les rectangles d'aire nulle.
- Mode `rien` : l'insert est le rectangle englobant des zones.
- Mode `usagees` : l'insert est `utile`. Le rectangle libre de plus grande aire devient une zone `usagees` si ses deux côtés font au moins 40. Sa hauteur est celle de la zone la plus haute. Son étiquette est `USAGÉES`, avec `hauteurTexte('USAGÉES', largeur − 3.2)`. Sinon, avertissement `usagees_impossible`.
- Mode `plus` : l'insert est `utile`. Dans chaque rectangle libre, poser la grille du type choisi qui contient le plus d'alvéoles, entre les deux orientations. Sans aucune quantité demandée, le rectangle libre est `utile` entier.
- `insert.hauteur` : la plus grande hauteur de zone.
- Avertissement `plateau` si l'insert ne tient dans le plateau dans aucune des deux orientations.
- Avertissement `hauteur`, une fois par type, si `fond + hauteurDebout` dépasse `tiroir.hauteur`.

`verifierInvariants` vérifie : aucune zone n'en chevauche une autre, toutes sont dans l'insert, l'insert tient dans `utile`, chaque type demandé a au moins le nombre d'alvéoles demandé, `insert.hauteur` est le maximum des hauteurs.

- [ ] **Step 1: Écrire les tests**

Base : tiroir 300 × 400, plateau 256 × 256, `OPTIONS_DEFAUT`, mode `rien`.
- AA × 12 : une zone 4×3, insert 65.6 × 57.5 × 22.2, étiquette `{ texte: 'AA', hauteurTexte: 6 }`, aucun avertissement.
- AA × 8, AAA × 8, 9V × 2, CR2032 × 6 : `ok`, `verifierInvariants` passe. Idem en modes `usagees` et `plus`.
- Mode `usagees`, AA × 12 : insert 299 × 399, une zone `usagees` dont les deux côtés font au moins 40, avertissement `plateau`.
- Mode `usagees`, tiroir 70 × 60, AA × 12 : avertissement `usagees_impossible`, aucune zone `usagees`.
- Mode `plus` avec `aa`, tiroir 100 × 100, aucune quantité : une zone de 6 × 5 = 30 alvéoles, insert 99 × 99.
- Tiroir de hauteur 50, AA × 1 : avertissement `{ code: 'hauteur', pileId: 'aa', hauteurTotale: 52.5 }`.
- CR2032 × 1 : avertissement `etiquette_omise` pour `cr2032`, zone sans `etiquette`.
- Tiroir 30 × 30, D × 1 : `{ ok: false, erreurs: [{ code: 'ne_rentre_pas', pileIds: ['d'] }] }`.
- Aucune quantité : erreur `aucune_pile`.
- Saisie : `tiroir.largeur` à 29, à `NaN` ; `quantites.aa` à 501, à 1.5, à −1 ; `quantites.xyz` à 3 ; `options.profondeurPct` à 19. Chaque cas rend une erreur `saisie` avec le bon `champ`.
- Deux appels identiques rendent des plans égaux.

- [ ] **Step 2: Lancer, vérifier l'échec** — Run: `npm test` — Expected: FAIL.
- [ ] **Step 3: Écrire `reste.ts` et `index.ts`**
- [ ] **Step 4: Vérifier** — Run: `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: full layout plan with leftover modes, validation and warnings"`

---

### Task 7: Géométrie du corps

**Files:**
- Create: `src/scad/insert_piles.scad`, `src/scad/generer.ts`, `tests/aide/rendu.ts`
- Test: `tests/scad/generer.test.ts`, `tests/geometrie/corps.test.ts`

**Interfaces:**
- Consumes: `calculerPlan`, `caseDe`, `rendre`, `lireStl`, `chargerPolice`.
- Produces:
  - `genererScad(plan: PlanOk, d: Demande): string`
  - `tests/aide/rendu.ts` : `rendreDemande(d: Demande, piece: Piece): Promise<Maillage>` (lève une erreur si le plan n'est pas `ok`)

Format du fichier généré. `generer.ts` importe la bibliothèque avec `import bibliotheque from './insert_piles.scad?raw'` et l'ajoute à la fin.

```scad
// Insert Piles : fichier généré. S'ouvre tel quel dans OpenSCAD.
piece = "tout"; // "corps", "etiquettes" ou "tout"
fond = 2; jeu = 0.4; paroi = 1.2;
mode_etiquettes = "relief"; // "aucune", "relief" ou "grave"
encoches = true;
insert = [65.6, 57.5];
// [genre, x, y, largeur, profondeur, hauteur, colonnes, rangees, tournee,
//  pasX, pasY, a, b, profAlveole, texte, hauteurTexte]
zones = [
  ["cyl", 0, 0, 65.6, 57.5, 22.2, 4, 3, false, 16.1, 16.1, 14.5, 0, 20.2, "AA", 6],
];
```

- `genre` : `"cyl"` (`a` = diamètre), `"rect"` (`a` = longueur, `b` = largeur), `"bouton"` (`a` = diamètre, `b` = épaisseur), `"bac"` (`colonnes`, `rangees`, `pasX`, `pasY`, `a`, `b` à 0 ; `profAlveole = hauteur − fond`).
- `texte` vaut `""` sans étiquette, et `hauteurTexte` vaut alors 0.
- Nombres arrondis à 3 décimales, sans zéros inutiles. Guillemets et barres obliques inverses échappés dans `texte`.

Géométrie de la pièce `corps`, dans `insert_piles.scad` (`$fn = 48`, point d'entrée `module insert()` appelé en fin de fichier) :
- Une plaque `insert.x × insert.y × fond`, plus un bloc plein par zone à sa hauteur.
- Centre de l'alvéole `(i, j)` dans la zone : `x = paroi/2 + (i + 0.5) × pasX`, `y = bande + paroi/2 + (j + 0.5) × pasY`, avec `bande = 8` sauf en mode `"aucune"`.
- Toute alvéole va de `hauteur − profAlveole` jusqu'au-dessus de la zone.
- `cyl` : cylindre de diamètre `a + jeu`.
- `rect` : poche `(a + jeu) × (b + jeu)`, coins arrondis de rayon 2, côtés échangés si `tournee`.
- `cyl` et `rect` : chanfrein en haut de `min(0.6, paroi / 4)`.
- `bouton` : fente de largeur `b + jeu` dans le sens de l'épaisseur et de longueur `a + jeu`. Fond arrondi : la partie basse est un cylindre couché de diamètre `a + jeu`, d'axe parallèle à l'épaisseur. Pas de chanfrein.
- `bac` : le bloc évidé, parois de 1.6, fond d'épaisseur `fond`.
- Les découpes d'une zone sont limitées à l'emprise de cette zone.
- Dans cette tâche, `tout` rend la même chose que `corps`. Les encoches et les étiquettes arrivent à la tâche 8.

- [ ] **Step 1: Écrire les tests du générateur**

`tests/scad/generer.test.ts`, pour AA × 12 en mode `rien` : le texte contient `piece = "tout";`, `fond = 2; jeu = 0.4; paroi = 1.2;`, `mode_etiquettes = "relief";`, `insert = [65.6, 57.5];`, la ligne de zone exacte de l'exemple ci-dessus, et `module insert()`. En mode `usagees`, une ligne commence par `["bac",` et contient `"USAGÉES"`. Un `texte` contenant `"` ressort échappé.

- [ ] **Step 2: Écrire les tests de géométrie**

`tests/geometrie/corps.test.ts` (délai 120 s). Base : tiroir 300 × 400, mode `rien`, pièce `corps`, tolérance 0,01 sur les boîtes.
- AA × 12, étiquettes `'aucune'` : boîte `[0,0,0]` à `[65.6, 49.5, 22.2]`, `estFerme`, volume égal à `65.6 × 49.5 × 22.2 − 12 × π × 7.45² × 20.2` (29 821) à 1,5 % près.
- 9V × 2, étiquettes `'aucune'`, `encoches: false` : `estFerme`, volume égal au bloc moins `2 × 26.9 × 17.9 × 19.4` à 4 % près.
- CR2032 × 6, `encoches: false` : `estFerme`, volume inférieur au bloc plein, boîte égale à `plan.insert`.
- AA × 8, AAA × 8, 9V × 2, CR2032 × 6 : `estFerme`, boîte égale à `plan.insert` (largeur, profondeur, hauteur).
- Mode `usagees`, AA × 12 : boîte de 299 × 399, `estFerme`.

- [ ] **Step 3: Lancer, vérifier l'échec** — Run: `npm test` — Expected: FAIL.
- [ ] **Step 4: Écrire `generer.ts` et `insert_piles.scad`**
- [ ] **Step 5: Vérifier** — Run: `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: SCAD generator and insert body geometry"`

---

### Task 8: Encoches, étiquettes et pièces

**Files:**
- Modify: `src/scad/insert_piles.scad`, `src/scad/generer.ts`
- Test: `tests/geometrie/etiquettes.test.ts`, `tests/geometrie/encoches.test.ts`

**Interfaces:**
- Consumes: tout ce que produit la tâche 7.
- Produces: `aDesEtiquettes(plan: PlanOk): boolean` dans `generer.ts` (vrai si au moins une zone a une `etiquette`). Les trois valeurs de `piece` sont maintenant distinctes.

Géométrie :
- **Étiquette de zone de piles** : `text(texte, size = hauteurTexte, font = "Liberation Sans:style=Bold", halign = "center", valign = "center")`, centrée en `x = largeur / 2`, `y = 4` dans la zone.
- **Étiquette du bac** : centrée en `x`, à `y = 1.6 + 2 + hauteurTexte / 2`, posée sur le fond du bac (`z = fond`).
- **Relief** : le texte est extrudé de 0.6 au-dessus de sa surface. **Gravé** : il occupe les 0.6 sous sa surface.
- `corps` : en mode gravé, le texte est soustrait du corps. `etiquettes` : le texte seul. `tout` : union du corps et des étiquettes en relief ; le corps seul en mode gravé ou sans étiquettes.
- **Encoches bouton** (si `encoches`) : aux deux bouts de la fente, sur le quart extérieur de sa longueur et jusqu'au bord de la case, le bloc est abaissé à `fond + 0.30 × a`, sur toute la largeur de la case.
- **Encoches rect** (si `encoches`) : un cylindre vertical de rayon 7 centré au milieu de chaque petit côté de la poche, du dessus jusqu'à la moitié de `profAlveole`.

- [ ] **Step 1: Écrire les tests des étiquettes**

Base : AA × 12, tiroir 300 × 400, mode `rien`.
- Relief, pièce `etiquettes` : `z` de 22.2 à 22.8, `y` entre 0 et 8, `x` entre 0 et 65.6. `volume(tout)` vaut `volume(corps) + volume(etiquettes)` à 0,5 % près. `estFerme(tout)`.
- Gravé, pièce `etiquettes` : `z` de 21.6 à 22.2. `volume(corps gravé) + volume(etiquettes gravé)` vaut `volume(corps relief)` à 0,5 % près. La pièce `tout` a le même volume que `corps`.
- Mode `usagees`, relief, pièce `etiquettes` : la boîte commence à `z = 2`.
- CR2032 × 1, relief puis gravé : `aDesEtiquettes(plan)` est faux, et les pièces `corps` et `tout` se rendent sans erreur.
- AA × 12 : `aDesEtiquettes(plan)` est vrai.

- [ ] **Step 2: Écrire les tests des encoches**

- CR2032 × 6 : `volume(encoches: true) < volume(encoches: false)`, `estFerme`, même boîte.
- 9V × 2 : même vérification.
- AA × 12 : les deux volumes sont égaux à 0,01 % près.
- 9V × 2 et AA × 8 ensemble, encoches actives : `estFerme`, boîte égale à `plan.insert`.

- [ ] **Step 3: Lancer, vérifier l'échec** — Run: `npm test` — Expected: FAIL.
- [ ] **Step 4: Compléter `insert_piles.scad` et `generer.ts`**
- [ ] **Step 5: Vérifier** — Run: `npm test` — Expected: PASS, y compris les tests de la tâche 7.
- [ ] **Step 6: Commit** — `git commit -m "feat: finger notches, labels and separate parts"`

---

### Task 9: Exports

**Files:**
- Create: `src/export/troismf.ts`, `src/export/fichiers.ts`
- Test: `tests/export/troismf.test.ts`, `tests/export/fichiers.test.ts`

**Interfaces:**
- Consumes: `Maillage` (tâche 2), `PlanOk`.
- Produces:
  - `creer3mf(pieces: { nom: string; maillage: Maillage }[]): Uint8Array`
  - `nomFichier(plan: PlanOk, extension: 'stl' | '3mf' | 'scad'): string`
  - `telecharger(contenu: Uint8Array | string, nom: string, mime: string): void`

Le 3MF est une archive zip (fflate, `zipSync`) avec `[Content_Types].xml`, `_rels/.rels` et `3D/3dmodel.model`. Le modèle a `unit="millimeter"`. Chaque pièce est un `<object type="model">` avec un `<mesh>` aux sommets dédupliqués et un attribut `name`. Avec plusieurs pièces, un objet supplémentaire les regroupe par `<components>`, et `<build>` ne référence que lui. Avec une seule pièce, `<build>` la référence directement.

- [ ] **Step 1: Écrire les tests**

- `creer3mf` avec deux cubes (`corps`, `etiquettes`), relu avec `unzipSync` : les trois fichiers existent. Le modèle contient deux `<mesh>`, 8 `<vertex` et 12 `<triangle` par maillage, un `<components>` avec deux `<component`, un seul `<item`, les noms `corps` et `etiquettes`.
- `creer3mf` avec une seule pièce : un `<mesh>`, aucun `<components>`, un `<item`.
- `creer3mf([])` lève une erreur.
- `nomFichier` pour un insert de 65.6 × 57.5 : `insert-piles-66x58.stl`, `.3mf`, `.scad`.

- [ ] **Step 2: Lancer, vérifier l'échec** — Run: `npm test` — Expected: FAIL.
- [ ] **Step 3: Écrire `troismf.ts` et `fichiers.ts`** (`telecharger` crée un `Blob` et clique sur un lien temporaire)
- [ ] **Step 4: Vérifier** — Run: `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 3MF writer and download helpers"`

---

### Task 10: Aperçus

**Files:**
- Create: `src/apercu/Plan2D.tsx`, `src/apercu/Vue3D.tsx`
- Test: `tests/apercu/plan2d.test.tsx`

**Interfaces:**
- Consumes: `PlanOk`, `Zone`, `caseDe`, `pileParId`, `Maillage`.
- Produces:
  - `<Plan2D plan={PlanOk} demande={Demande} />` : un `<svg data-testid="plan2d">`.
  - `<Vue3D corps={Maillage | null} etiquettes={Maillage | null} occupe={boolean} />` : un conteneur `data-testid="vue3d"` avec `data-etat` (`vide`, `calcul` ou `pret`) et `data-triangles` (triangles du corps).

`Plan2D` : `viewBox` aux dimensions de l'insert, l'avant du tiroir en bas. Un `<rect class="zone">` par zone, un `<circle class="alveole">` par alvéole cylindrique, un `<rect class="alveole">` par alvéole rectangulaire ou fente, un `<text>` par étiquette.

`Vue3D` : Three.js avec `OrbitControls`. Le corps est gris, les étiquettes dans la couleur d'accent. L'axe Z d'OpenSCAD pointe vers le haut. La caméra cadre le modèle à chaque nouveau maillage. Pendant un calcul, le dernier modèle reste affiché avec un indicateur. Les géométries sont libérées au remplacement.

- [ ] **Step 1: Écrire le test du plan 2D**

Avec `preact-render-to-string`, pour AA × 12 : un `rect.zone`, 12 `circle.alveole`, un `<text>` contenant `AA`. Pour AA × 8 et CR2032 × 6 : deux `rect.zone`, 8 `circle.alveole`, 6 `rect.alveole`.

- [ ] **Step 2: Lancer, vérifier l'échec** — Run: `npm test` — Expected: FAIL.
- [ ] **Step 3: Écrire `Plan2D.tsx` et `Vue3D.tsx`** (`Vue3D` est vérifiée de bout en bout à la tâche 11)
- [ ] **Step 4: Vérifier** — Run: `npm test && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 2D plan and 3D preview components"`

---

### Task 11: Interface complète

**Files:**
- Create: `src/interface/App.tsx`, `Formulaire.tsx`, `Messages.tsx`, `etat.ts`, `messages.ts`, `saisie.ts`, `calcul3d.ts`, `imprimantes.ts`, `src/style.css`
- Modify: `src/main.tsx` (affiche `App`, garde `?diagnostic=1`)
- Test: `tests/interface/saisie.test.ts`, `messages.test.ts`, `etat.test.ts`, `calcul3d.test.ts`, `e2e/parcours.spec.ts`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces:
  - `lireNombre(texte: string): number | null` (accepte la virgule et le point ; `null` si vide ou invalide)
  - `texteErreur(e: Erreur): string`, `texteAvertissement(a: Avertissement, plan: PlanOk, d: Demande): string`
  - `DEMANDE_DEFAUT: Demande`, `chargerDemande(stockage?: Storage): Demande`, `sauverDemande(d: Demande, stockage?: Storage): void`, clé `insert-piles:demande:v1`
  - `IMPRIMANTES: { nom: string; largeur: number; profondeur: number }[]`
  - `creerCalcul3d(moteur: Moteur, surResultat: (r: Resultat3d) => void, delaiMs?: number): { demander(scad: string, avecEtiquettes: boolean): void; arreter(): void }`
  - `type Resultat3d = { etat: 'calcul' } | { etat: 'pret'; corps: Uint8Array; etiquettes: Uint8Array | null } | { etat: 'erreur'; message: string }`

Textes exacts :

| Cas | Texte |
|---|---|
| `ne_rentre_pas` | `Ça ne rentre pas dans le tiroir. Types à réduire ou à retirer : AA, 9V.` |
| `saisie` | `Valeur hors limites : largeur du tiroir.` (un libellé français par champ) |
| `aucune_pile` | `Ajoute au moins une pile.` |
| `plateau` | `L'insert (299 × 399 mm) dépasse du plateau d'impression (256 × 256 mm).` |
| `hauteur` | `La pile AA debout monte à 52,5 mm : elle dépasse la hauteur du tiroir.` |
| `etiquette_omise` | `Zone CR2032 trop étroite : pas d'étiquette.` |
| `usagees_impossible` | `Pas assez de place pour la zone « usagées ».` |
| Moteur non chargé | `Le moteur 3D n'a pas pu se charger. Le plan 2D et le fichier .scad restent disponibles.` |
| Calcul échoué | `Le calcul 3D a échoué. Le dernier modèle valide reste affiché.` |
| Pied de page | `Géométrie calculée par OpenSCAD, logiciel libre sous licence GPL.` avec un lien vers `https://github.com/openscad/openscad` |

Comportement :
- `DEMANDE_DEFAUT` : tiroir 300 × 400 sans hauteur, plateau 256 × 256, AA × 8, AAA × 8, 9V × 2, CR2032 × 6, mode `rien`, `OPTIONS_DEFAUT`.
- `IMPRIMANTES` : Bambu A1 mini 180 × 180, Bambu A1 / P1 / X1 256 × 256, Prusa MK4 250 × 210, Prusa Mini 180 × 180, Ender 3 220 × 220. Le formulaire ajoute « Personnalisé ».
- `chargerDemande` : rend `DEMANDE_DEFAUT` si la clé est absente, si le JSON est invalide, si la forme ne correspond pas, ou si `calculerPlan` y trouve une erreur `saisie`. Les quantités de piles inconnues sont retirées avant ce contrôle.
- `creerCalcul3d` : attend `delaiMs` (500 par défaut) après le dernier `demander`. Il appelle alors `moteur.annuler()`, signale `calcul`, puis rend `corps`, et `etiquettes` seulement si `avecEtiquettes`. Un résultat qui n'est plus celui de la dernière demande est jeté. `ErreurAnnulee` est ignorée.
- `App` : le plan 2D suit chaque changement. La 3D est demandée seulement si le plan est `ok`. Si le plan n'est pas `ok`, les trois boutons sont désactivés. Si le moteur échoue, le bouton `.scad` reste actif.
- Boutons : `Télécharger le STL` (rend la pièce `tout` au clic), `Télécharger le 3MF`, `Télécharger le .scad`.
- Mise en page : deux colonnes au-dessus de 900 px, une seule en dessous. Aucun défilement horizontal à 390 px. Les réglages avancés sont dans un `<details>` fermé.
- Chaque champ numérique garde le texte tapé. Un texte invalide marque le champ avec `aria-invalid="true"` et laisse la dernière valeur valide dans la demande.

- [ ] **Step 1: Écrire les tests unitaires**

- `lireNombre` : `'0,4'` → 0.4, `'12.5'` → 12.5, `' 30 '` → 30, `''` → `null`, `'abc'` → `null`, `'1,2,3'` → `null`.
- `messages` : chaque ligne du tableau ci-dessus, mot pour mot, avec les valeurs de l'exemple.
- `etat` (avec un faux `Storage`) : clé absente, JSON corrompu, objet sans `tiroir`, tiroir de largeur 5 → `DEMANDE_DEFAUT`. Une quantité `xyz: 3` est retirée et le reste est conservé. Ce que `sauverDemande` écrit est relu à l'identique.
- `calcul3d` (faux moteur, minuteries simulées) : trois `demander` en 100 ms ne lancent qu'un rendu. Si le rendu A se termine après le lancement de B, seul le résultat de B arrive. Avec `avecEtiquettes` faux, la pièce `etiquettes` n'est jamais demandée et le résultat porte `etiquettes: null`. Un rendu qui rejette donne `{ etat: 'erreur' }`.

- [ ] **Step 2: Écrire le test de bout en bout**

`e2e/parcours.spec.ts` :
- À l'ouverture, `[data-testid="plan2d"]` est visible. Puis `[data-testid="vue3d"]` passe à `data-etat="pret"` avec `data-triangles` supérieur à 100 (délai 90 s).
- `Télécharger le STL` donne un fichier nommé `insert-piles-<n>x<n>.stl` de plus de 1000 octets. Idem pour le 3MF (le fichier commence par `PK`) et le `.scad` (le texte contient `module insert()`).
- Taper `0,6` dans le champ du jeu : le champ n'est pas invalide. Taper `abc` : `aria-invalid="true"`.
- Mettre le tiroir à 30 × 30 et une pile D : le message `Ça ne rentre pas dans le tiroir` s'affiche et les trois boutons sont désactivés.
- Après rechargement de la page, les réglages modifiés sont toujours là.
- En 390 × 800 : `document.documentElement.scrollWidth` ne dépasse pas 390.

- [ ] **Step 3: Lancer, vérifier l'échec** — Run: `npm test; npm run e2e` — Expected: FAIL.
- [ ] **Step 4: Écrire l'interface**
- [ ] **Step 5: Vérifier** — Run: `npm test && npm run e2e` — Expected: PASS, y compris `e2e/moteur.spec.ts`.
- [ ] **Step 6: Regarder le résultat**

Prendre deux captures avec Playwright (1280 × 900 et 390 × 800, `deviceScaleFactor: 2`), les regarder, corriger ce qui cloche, puis les envoyer à Johnny.

- [ ] **Step 7: Commit** — `git commit -m "feat: complete user interface"`

---

### Task 12: Intégration continue, publication et README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: les scripts npm `test`, `build`, `e2e`.

- [ ] **Step 1: Écrire `.github/workflows/ci.yml`**

Déclenché sur chaque push et chaque pull request. Job `test` (Ubuntu, Node 22) : `npm ci`, `npm test`, `npx playwright install --with-deps chromium`, `npm run e2e`, puis envoi de `dist/` avec `actions/upload-pages-artifact`. Job `publier` : seulement sur `main`, après `test`, avec `actions/deploy-pages`, permissions `pages: write` et `id-token: write`, environnement `github-pages`.

- [ ] **Step 2: Écrire `README.md`**

En français : ce que fait l'outil, les commandes (`npm install`, `npm run dev`, `npm test`, `npm run e2e`, `npm run build`), comment l'héberger (copier `dist/` dans n'importe quel dossier d'un site), comment ajouter une pile (une entrée dans `src/catalogue.ts`), et la mention GPL d'OpenSCAD avec le lien vers ses sources.

- [ ] **Step 3: Vérifier**

Run: `npm ci && npm test && npm run e2e` — Expected: PASS depuis une installation propre.
Run: `npx --yes actionlint .github/workflows/ci.yml` — Expected: aucune erreur. Si l'outil ne se télécharge pas, le signaler et relire le fichier à la main.

- [ ] **Step 4: Commit et push**

`git commit -m "ci: test, build and publish workflow; add README"`, puis `git push -u origin dev`.

- [ ] **Step 5: Passer la main à Johnny**

Lui dire ce qui est fait et vérifié, et ce qui reste à sa charge : activer GitHub Pages (Settings, Pages, Source : GitHub Actions), autoriser la fusion de `dev` dans `main`, tester l'import du 3MF dans son slicer, choisir la licence du projet.
