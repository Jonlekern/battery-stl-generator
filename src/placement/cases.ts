import { C, type Options, type Pile } from '../types';

/** Écart toléré dans les comparaisons de dimensions. */
export const EPS = 1e-6;

/** Supprime le bruit des calculs en virgule flottante (au dix-millième de mm). */
export function arrondir(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

export interface Case {
  /** Distance entre deux alvéoles voisines, en X et en Y. */
  pasX: number;
  pasY: number;
  profondeurAlveole: number;
  /** Hauteur du bloc de la zone : fond + profondeur d'alvéole. */
  hauteurZone: number;
  /** Hauteur de la pile une fois rangée (diamètre pour une pile bouton). */
  hauteurDebout: number;
}

export function caseDe(pile: Pile, o: Options, tournee: boolean): Case {
  const marge = o.jeu + o.paroi;
  let pasX: number;
  let pasY: number;
  let profondeurAlveole: number;
  let hauteurDebout: number;

  switch (pile.famille) {
    case 'cylindrique':
      pasX = pasY = pile.diametre + marge;
      profondeurAlveole = (pile.hauteur * o.profondeurPct) / 100;
      hauteurDebout = pile.hauteur;
      break;
    case 'rectangulaire':
      pasX = pile.longueur + marge;
      pasY = pile.largeur + marge;
      profondeurAlveole = (pile.hauteur * o.profondeurPct) / 100;
      hauteurDebout = pile.hauteur;
      break;
    case 'bouton':
      // Sur la tranche : le diamètre en X, l'épaisseur en Y.
      pasX = pile.diametre + marge;
      pasY = pile.epaisseur + marge;
      profondeurAlveole = (pile.diametre * C.PROF_BOUTON_PCT) / 100;
      hauteurDebout = pile.diametre;
      break;
  }

  if (tournee) [pasX, pasY] = [pasY, pasX];

  return {
    pasX: arrondir(pasX),
    pasY: arrondir(pasY),
    profondeurAlveole: arrondir(profondeurAlveole),
    hauteurZone: arrondir(o.fond + profondeurAlveole),
    hauteurDebout,
  };
}

/** Profondeur réservée à l'étiquette à l'avant d'une zone. */
export function bandeEtiquette(o: Options): number {
  return o.etiquettes === 'aucune' ? 0 : C.BANDE;
}

export interface Forme {
  colonnes: number;
  rangees: number;
  tournee: boolean;
  largeur: number;
  profondeur: number;
}

/** Dimensions d'une zone qui contient une grille de `colonnes` × `rangees`. */
export function dimensionsZone(
  c: Case,
  colonnes: number,
  rangees: number,
  o: Options,
): { largeur: number; profondeur: number } {
  return {
    largeur: arrondir(colonnes * c.pasX + o.paroi),
    profondeur: arrondir(rangees * c.pasY + o.paroi + bandeEtiquette(o)),
  };
}

/**
 * Grilles possibles pour `quantite` piles, limitées à celles qui tiennent
 * dans la surface utile. Une seule forme par nombre de rangées : la moins large.
 */
export function formesPossibles(
  pile: Pile,
  quantite: number,
  o: Options,
  utile: { largeur: number; profondeur: number },
): Forme[] {
  const formes: Forme[] = [];
  const orientations = pile.famille === 'cylindrique' ? [false] : [false, true];

  for (const tournee of orientations) {
    const c = caseDe(pile, o, tournee);
    let rangeesPrecedentes = Infinity;
    for (let colonnes = 1; colonnes <= quantite; colonnes++) {
      const rangees = Math.ceil(quantite / colonnes);
      if (rangees === rangeesPrecedentes) continue; // forme plus large pour rien
      rangeesPrecedentes = rangees;
      const { largeur, profondeur } = dimensionsZone(c, colonnes, rangees, o);
      if (largeur > utile.largeur + EPS) break; // les suivantes sont encore plus larges
      if (profondeur > utile.profondeur + EPS) continue;
      formes.push({ colonnes, rangees, tournee, largeur, profondeur });
    }
  }
  return formes;
}

/**
 * Hauteur du texte d'une étiquette pour qu'il tienne dans `largeurDispo`.
 * Rend `null` si le texte serait trop petit pour être lisible.
 */
export function hauteurTexte(texte: string, largeurDispo: number): number | null {
  const ajustee = (largeurDispo - C.MARGE_TEXTE) / (C.FACTEUR_TEXTE * texte.length);
  const h = Math.min(C.TEXTE_MAX, ajustee);
  return h < C.TEXTE_MIN ? null : arrondir(h);
}
