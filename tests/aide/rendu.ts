import { lireStl, type Maillage } from '../../src/export/stl';
import { rendre } from '../../src/moteur/openscad';
import { calculerPlan } from '../../src/placement';
import { genererScad } from '../../src/scad/generer';
import { OPTIONS_DEFAUT, type Demande, type Piece, type PlanOk } from '../../src/types';
import { chargerPolice } from './police';

/** Demande de base des tests : tiroir 300 × 400, plateau 256 × 256, mode « rien ». */
export function demande(surcharge: Partial<Demande> = {}): Demande {
  return {
    tiroir: { largeur: 300, profondeur: 400 },
    plateau: { largeur: 256, profondeur: 256 },
    quantites: {},
    reste: { mode: 'rien' },
    options: OPTIONS_DEFAUT,
    ...surcharge,
  };
}

export function planOk(d: Demande): PlanOk {
  const plan = calculerPlan(d);
  if (!plan.ok) throw new Error(`plan refusé : ${JSON.stringify(plan.erreurs)}`);
  return plan;
}

/** Génère le .scad d'un plan et le rend avec le vrai OpenSCAD. */
export async function rendrePlan(plan: PlanOk, d: Demande, piece: Piece): Promise<Maillage> {
  return lireStl(await rendre(genererScad(plan, d), piece, chargerPolice()));
}

/** Calcule le plan d'une demande, puis le rend. */
export function rendreDemande(d: Demande, piece: Piece): Promise<Maillage> {
  return rendrePlan(planOk(d), d, piece);
}
