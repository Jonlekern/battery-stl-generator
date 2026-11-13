import { EPS, arrondir, type Forme } from './cases';

export interface Candidat {
  pileId: string;
  formes: Forme[];
}

export interface Placee {
  pileId: string;
  forme: Forme;
  x: number;
  y: number;
}

/** Une rangée de zones posées côte à côte, de l'avant vers le fond du tiroir. */
export interface Etagere {
  y: number;
  profondeur: number;
  /** Abscisse où s'arrête la dernière zone de l'étagère. */
  xFin: number;
}

export type Rangement =
  | { ok: true; placees: Placee[]; etageres: Etagere[]; largeur: number; profondeur: number }
  | { ok: false; nonPlaces: string[] };

interface Surface {
  largeur: number;
  profondeur: number;
}

interface Essai {
  placees: Placee[];
  etageres: Etagere[];
  nonPlaces: string[];
  largeur: number;
  profondeur: number;
}

const MAX_CIBLES = 60;

const parId = (a: { pileId: string }, b: { pileId: string }) =>
  a.pileId < b.pileId ? -1 : a.pileId > b.pileId ? 1 : 0;

/** Profondeurs d'étagère à essayer : celles des formes, 60 au plus. */
function cibles(candidats: Candidat[]): number[] {
  const toutes = [...new Set(candidats.flatMap((c) => c.formes.map((f) => f.profondeur)))].sort(
    (a, b) => a - b,
  );
  if (toutes.length <= MAX_CIBLES) return toutes;
  const choisies = new Set<number>();
  for (let i = 0; i < MAX_CIBLES; i++) {
    choisies.add(toutes[Math.round((i * (toutes.length - 1)) / (MAX_CIBLES - 1))]);
  }
  return [...choisies];
}

/** La forme la moins large parmi celles qui tiennent sous la cible. */
function choisirForme(formes: Forme[], cible: number): Forme {
  let meilleure: Forme | undefined;
  for (const f of formes) {
    if (f.profondeur > cible + EPS) continue;
    if (
      !meilleure ||
      f.largeur < meilleure.largeur - EPS ||
      (Math.abs(f.largeur - meilleure.largeur) <= EPS && f.profondeur < meilleure.profondeur - EPS)
    ) {
      meilleure = f;
    }
  }
  if (meilleure) return meilleure;
  // Aucune ne tient sous la cible : on prend la moins profonde.
  return formes.reduce((a, b) => (b.profondeur < a.profondeur - EPS ? b : a));
}

/** Pose les formes de gauche à droite, étagère après étagère. */
function poser(choix: { pileId: string; forme: Forme }[], utile: Surface): Essai {
  const ordre = [...choix].sort((a, b) => b.forme.profondeur - a.forme.profondeur || parId(a, b));
  const placees: Placee[] = [];
  const etageres: Etagere[] = [];
  const nonPlaces: string[] = [];
  let courante: Etagere | undefined;

  for (const { pileId, forme } of ordre) {
    const tientSurLEtagere =
      courante !== undefined && courante.xFin + forme.largeur <= utile.largeur + EPS;
    const x = tientSurLEtagere ? courante!.xFin : 0;
    const y = tientSurLEtagere
      ? courante!.y
      : courante
        ? arrondir(courante.y + courante.profondeur)
        : 0;

    if (forme.largeur > utile.largeur + EPS || y + forme.profondeur > utile.profondeur + EPS) {
      nonPlaces.push(pileId);
      continue;
    }
    if (!tientSurLEtagere) {
      courante = { y, profondeur: forme.profondeur, xFin: 0 };
      etageres.push(courante);
    }
    placees.push({ pileId, forme, x, y });
    courante!.xFin = arrondir(x + forme.largeur);
    courante!.profondeur = Math.max(courante!.profondeur, forme.profondeur);
  }

  const derniere = etageres[etageres.length - 1];
  return {
    placees,
    etageres,
    nonPlaces: nonPlaces.sort(),
    largeur: etageres.reduce((m, e) => Math.max(m, e.xFin), 0),
    profondeur: derniere ? arrondir(derniere.y + derniere.profondeur) : 0,
  };
}

/** Vrai si `a` est un meilleur rangement complet que `b` : plus proche du carré. */
function plusCompact(a: Essai, b: Essai): boolean {
  const perimetreA = a.largeur + a.profondeur;
  const perimetreB = b.largeur + b.profondeur;
  if (Math.abs(perimetreA - perimetreB) > EPS) return perimetreA < perimetreB;
  return a.profondeur < b.profondeur - EPS;
}

/**
 * Range une zone par candidat dans la surface utile.
 *
 * Pour chaque profondeur d'étagère cible, chaque candidat prend sa forme la
 * moins large qui tient sous la cible, puis les zones sont posées en rangées.
 * On garde le rangement complet dont le rectangle englobant a le plus petit
 * demi-périmètre. Le résultat ne dépend pas de l'ordre des candidats.
 */
export function ranger(candidats: Candidat[], utile: Surface): Rangement {
  const tries = [...candidats].sort(parId);
  const sansForme = tries.filter((c) => c.formes.length === 0).map((c) => c.pileId);
  const avecFormes = tries.filter((c) => c.formes.length > 0);

  let complet: Essai | undefined;
  let incomplet: Essai | undefined;

  // Les cibles sont croissantes : à égalité, le premier essai (la plus petite cible) reste.
  for (const cible of cibles(avecFormes)) {
    const essai = poser(
      avecFormes.map((c) => ({ pileId: c.pileId, forme: choisirForme(c.formes, cible) })),
      utile,
    );
    if (essai.nonPlaces.length === 0) {
      if (!complet || plusCompact(essai, complet)) complet = essai;
    } else if (!incomplet || essai.nonPlaces.length < incomplet.nonPlaces.length) {
      incomplet = essai;
    }
  }

  if (sansForme.length === 0) {
    if (complet) {
      const { placees, etageres, largeur, profondeur } = complet;
      return { ok: true, placees, etageres, largeur, profondeur };
    }
    if (!incomplet) return { ok: true, placees: [], etageres: [], largeur: 0, profondeur: 0 };
    return { ok: false, nonPlaces: incomplet.nonPlaces };
  }

  // Un type sans aucune forme ne rentre pas, même seul.
  const autres = complet ? [] : (incomplet?.nonPlaces ?? []);
  return { ok: false, nonPlaces: [...sansForme, ...autres].sort() };
}
