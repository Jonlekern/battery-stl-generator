import { pileParId } from '../catalogue';
import {
  C,
  LIMITES,
  type Avertissement,
  type Demande,
  type Erreur,
  type Pile,
  type Plan,
  type Zone,
} from '../types';
import { EPS, arrondir, caseDe, formesPossibles, hauteurTexte } from './cases';
import { ranger, type Candidat } from './rangement';
import { grilleMaximale, rectanglesLibres, zoneUsagees } from './reste';

export { rectanglesLibres, type Rect } from './reste';

export function nombreAlveoles(z: Zone): number {
  return z.colonnes * z.rangees;
}

function dansLimites(v: unknown, [min, max]: readonly [number, number]): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

function validerSaisie(d: Demande): Erreur[] {
  const champs: string[] = [];
  const verifier = (champ: string, v: unknown, limites: readonly [number, number]) => {
    if (!dansLimites(v, limites)) champs.push(champ);
  };

  verifier('tiroir.largeur', d.tiroir.largeur, LIMITES.tiroirCote);
  verifier('tiroir.profondeur', d.tiroir.profondeur, LIMITES.tiroirCote);
  if (d.tiroir.hauteur !== undefined) verifier('tiroir.hauteur', d.tiroir.hauteur, LIMITES.tiroirHauteur);
  verifier('plateau.largeur', d.plateau.largeur, LIMITES.plateauCote);
  verifier('plateau.profondeur', d.plateau.profondeur, LIMITES.plateauCote);

  for (const [id, q] of Object.entries(d.quantites)) {
    const valide = dansLimites(q, LIMITES.quantite) && Number.isInteger(q);
    const inconnueEtDemandee = !pileParId(id) && q !== 0;
    if (!valide || inconnueEtDemandee) champs.push(`quantites.${id}`);
  }
  if (d.reste.mode === 'plus' && !pileParId(d.reste.pileId)) champs.push('reste.pileId');

  verifier('options.jeu', d.options.jeu, LIMITES.jeu);
  verifier('options.fond', d.options.fond, LIMITES.fond);
  verifier('options.paroi', d.options.paroi, LIMITES.paroi);
  verifier('options.profondeurPct', d.options.profondeurPct, LIMITES.profondeurPct);

  return champs.map((champ) => ({ code: 'saisie', champ }));
}

/**
 * Calcule le plan de l'insert : où va chaque zone, la taille de l'insert, et
 * les avertissements. Fonction pure et déterministe.
 */
export function calculerPlan(d: Demande): Plan {
  const erreursSaisie = validerSaisie(d);
  if (erreursSaisie.length > 0) return { ok: false, erreurs: erreursSaisie };

  const o = d.options;
  const demandees = Object.entries(d.quantites)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ pile: pileParId(id)!, quantite: q }));

  if (demandees.length === 0 && d.reste.mode !== 'plus') {
    return { ok: false, erreurs: [{ code: 'aucune_pile' }] };
  }

  const utile = {
    largeur: arrondir(d.tiroir.largeur - C.JEU_TIROIR),
    profondeur: arrondir(d.tiroir.profondeur - C.JEU_TIROIR),
  };

  const candidats: Candidat[] = demandees.map(({ pile, quantite }) => ({
    pileId: pile.id,
    formes: formesPossibles(pile, quantite, o, utile),
  }));
  const rangement = ranger(candidats, utile);
  if (!rangement.ok) {
    return { ok: false, erreurs: [{ code: 'ne_rentre_pas', pileIds: rangement.nonPlaces }] };
  }

  const avertissements: Avertissement[] = [];
  const sansEtiquette = new Set<string>();

  const avecEtiquette = (zone: Zone, pile: Pile): Zone => {
    if (o.etiquettes === 'aucune') return zone;
    const h = hauteurTexte(pile.nom, zone.largeur);
    if (h === null) {
      sansEtiquette.add(pile.id);
      return zone;
    }
    return { ...zone, etiquette: { texte: pile.nom, hauteurTexte: h } };
  };

  const zones: Zone[] = rangement.placees.map(({ pileId, forme, x, y }) => {
    const pile = pileParId(pileId)!;
    return avecEtiquette(
      {
        genre: 'piles',
        pileId,
        x,
        y,
        largeur: forme.largeur,
        profondeur: forme.profondeur,
        hauteur: caseDe(pile, o, forme.tournee).hauteurZone,
        colonnes: forme.colonnes,
        rangees: forme.rangees,
        tournee: forme.tournee,
      },
      pile,
    );
  });

  let usageesImpossible = false;
  if (d.reste.mode === 'plus') {
    const pile = pileParId(d.reste.pileId)!;
    for (const libre of rectanglesLibres(rangement.etageres, utile)) {
      const grille = grilleMaximale(pile, libre, o);
      if (grille) zones.push(avecEtiquette(grille, pile));
    }
    if (zones.length === 0) {
      return { ok: false, erreurs: [{ code: 'ne_rentre_pas', pileIds: [pile.id] }] };
    }
  }

  const hauteur = Math.max(...zones.map((z) => z.hauteur));

  if (d.reste.mode === 'usagees') {
    const bac = zoneUsagees(rectanglesLibres(rangement.etageres, utile), hauteur, o);
    if (bac) zones.push(bac);
    else usageesImpossible = true;
  }

  const insert =
    d.reste.mode === 'rien'
      ? { largeur: rangement.largeur, profondeur: rangement.profondeur, hauteur }
      : { ...utile, hauteur };

  // Avertissements, dans un ordre fixe.
  const tient = (l: number, p: number) => l <= d.plateau.largeur + EPS && p <= d.plateau.profondeur + EPS;
  if (!tient(insert.largeur, insert.profondeur) && !tient(insert.profondeur, insert.largeur)) {
    avertissements.push({ code: 'plateau' });
  }

  const idsPresents = [...new Set(zones.flatMap((z) => (z.pileId ? [z.pileId] : [])))];
  if (d.tiroir.hauteur !== undefined) {
    for (const id of idsPresents) {
      const hauteurTotale = arrondir(o.fond + caseDe(pileParId(id)!, o, false).hauteurDebout);
      if (hauteurTotale > d.tiroir.hauteur + EPS) {
        avertissements.push({ code: 'hauteur', pileId: id, hauteurTotale });
      }
    }
  }
  for (const id of idsPresents) {
    if (sansEtiquette.has(id)) avertissements.push({ code: 'etiquette_omise', pileId: id });
  }
  if (usageesImpossible) avertissements.push({ code: 'usagees_impossible' });

  return { ok: true, insert, zones, avertissements };
}
