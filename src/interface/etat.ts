import { pileParId } from '../catalogue';
import { calculerPlan } from '../placement';
import { OPTIONS_DEFAUT, type Demande } from '../types';

export const CLE_STOCKAGE = 'insert-piles:demande:v1';

export const DEMANDE_DEFAUT: Demande = {
  tiroir: { largeur: 300, profondeur: 400 },
  plateau: { largeur: 256, profondeur: 256 },
  quantites: { aa: 8, aaa: 8, '9v': 2, cr2032: 6 },
  reste: { mode: 'rien' },
  options: OPTIONS_DEFAUT,
};

const copie = (d: Demande): Demande => structuredClone(d);

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const estNombre = (v: unknown): v is number => typeof v === 'number';

/** Vérifie la forme des données relues. Les valeurs sont contrôlées ensuite par calculerPlan. */
function aLaFormeDUneDemande(v: unknown): v is Demande {
  if (!estObjet(v)) return false;
  const { tiroir, plateau, quantites, reste, options } = v;
  if (!estObjet(tiroir) || !estNombre(tiroir.largeur) || !estNombre(tiroir.profondeur)) return false;
  if (tiroir.hauteur !== undefined && !estNombre(tiroir.hauteur)) return false;
  if (!estObjet(plateau) || !estNombre(plateau.largeur) || !estNombre(plateau.profondeur)) return false;
  if (!estObjet(quantites) || !Object.values(quantites).every(estNombre)) return false;
  if (!estObjet(reste)) return false;
  if (reste.mode === 'plus') {
    if (typeof reste.pileId !== 'string') return false;
  } else if (reste.mode !== 'rien' && reste.mode !== 'usagees') {
    return false;
  }
  if (!estObjet(options)) return false;
  return (
    estNombre(options.jeu) &&
    estNombre(options.fond) &&
    estNombre(options.paroi) &&
    estNombre(options.profondeurPct) &&
    (options.etiquettes === 'aucune' || options.etiquettes === 'relief' || options.etiquettes === 'grave') &&
    typeof options.encoches === 'boolean'
  );
}

function stockageDuNavigateur(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // accès interdit (navigation privée, iframe sans droits)
  }
}

/**
 * Relit les derniers réglages. Au moindre doute sur ce qui est relu, on
 * revient aux réglages par défaut : mieux vaut repartir de zéro que planter.
 */
export function chargerDemande(stockage: Storage | undefined = stockageDuNavigateur()): Demande {
  try {
    const brut = stockage?.getItem(CLE_STOCKAGE);
    if (!brut) return copie(DEMANDE_DEFAUT);
    const lu: unknown = JSON.parse(brut);
    if (!aLaFormeDUneDemande(lu)) return copie(DEMANDE_DEFAUT);

    // Une pile retirée du catalogue depuis la dernière visite disparaît sans bruit.
    const demande: Demande = {
      tiroir: { ...lu.tiroir },
      plateau: { ...lu.plateau },
      quantites: Object.fromEntries(Object.entries(lu.quantites).filter(([id]) => pileParId(id))),
      reste: { ...lu.reste },
      options: { ...lu.options },
    };
    const plan = calculerPlan(demande);
    if (!plan.ok && plan.erreurs.some((e) => e.code === 'saisie')) return copie(DEMANDE_DEFAUT);
    return demande;
  } catch {
    return copie(DEMANDE_DEFAUT);
  }
}

export function sauverDemande(d: Demande, stockage: Storage | undefined = stockageDuNavigateur()): void {
  try {
    stockage?.setItem(CLE_STOCKAGE, JSON.stringify(d));
  } catch {
    // Stockage plein ou interdit : les réglages ne seront pas mémorisés, c'est tout.
  }
}
