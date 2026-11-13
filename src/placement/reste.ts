import { C, type Options, type Pile, type Zone } from '../types';
import { EPS, arrondir, bandeEtiquette, caseDe, dimensionsZone, hauteurTexte } from './cases';
import type { Etagere } from './rangement';

export interface Rect {
  x: number;
  y: number;
  largeur: number;
  profondeur: number;
}

interface Surface {
  largeur: number;
  profondeur: number;
}

/**
 * Espace laissé libre par le rangement : à droite de chaque étagère, et la
 * bande sous la dernière. Les petits vides au-dessus des zones moins profondes
 * que leur étagère sont ignorés.
 */
export function rectanglesLibres(etageres: Etagere[], utile: Surface): Rect[] {
  const libres: Rect[] = [];
  let yFin = 0;
  for (const e of etageres) {
    const largeur = arrondir(utile.largeur - e.xFin);
    if (largeur > EPS && e.profondeur > EPS) {
      libres.push({ x: e.xFin, y: e.y, largeur, profondeur: e.profondeur });
    }
    yFin = arrondir(e.y + e.profondeur);
  }
  const profondeur = arrondir(utile.profondeur - yFin);
  if (profondeur > EPS && utile.largeur > EPS) {
    libres.push({ x: 0, y: yFin, largeur: utile.largeur, profondeur });
  }
  return libres;
}

/** Le bac « usagées » : le plus grand rectangle libre assez large, ou rien. */
export function zoneUsagees(libres: Rect[], hauteur: number, o: Options): Zone | undefined {
  const assezGrands = libres.filter((r) => r.largeur >= C.BAC_MIN - EPS && r.profondeur >= C.BAC_MIN - EPS);
  if (assezGrands.length === 0) return undefined;
  const r = assezGrands.reduce((a, b) => (b.largeur * b.profondeur > a.largeur * a.profondeur + EPS ? b : a));

  const zone: Zone = {
    genre: 'usagees',
    x: r.x,
    y: r.y,
    largeur: r.largeur,
    profondeur: r.profondeur,
    hauteur,
    colonnes: 0,
    rangees: 0,
    tournee: false,
  };
  if (o.etiquettes !== 'aucune') {
    const h = hauteurTexte(TEXTE_USAGEES, r.largeur - 2 * C.PAROI_BAC);
    if (h !== null) zone.etiquette = { texte: TEXTE_USAGEES, hauteurTexte: h };
  }
  return zone;
}

export const TEXTE_USAGEES = 'USAGÉES';

/** La plus grande grille de `pile` qui tient dans le rectangle, ou rien. */
export function grilleMaximale(pile: Pile, r: Rect, o: Options): Omit<Zone, 'etiquette'> | undefined {
  let meilleure: Omit<Zone, 'etiquette'> | undefined;
  const orientations = pile.famille === 'cylindrique' ? [false] : [false, true];
  for (const tournee of orientations) {
    const c = caseDe(pile, o, tournee);
    const colonnes = Math.floor((r.largeur - o.paroi + EPS) / c.pasX);
    const rangees = Math.floor((r.profondeur - o.paroi - bandeEtiquette(o) + EPS) / c.pasY);
    if (colonnes < 1 || rangees < 1) continue;
    if (meilleure && colonnes * rangees <= meilleure.colonnes * meilleure.rangees) continue;
    meilleure = {
      genre: 'piles',
      pileId: pile.id,
      x: r.x,
      y: r.y,
      ...dimensionsZone(c, colonnes, rangees, o),
      hauteur: c.hauteurZone,
      colonnes,
      rangees,
      tournee,
    };
  }
  return meilleure;
}
