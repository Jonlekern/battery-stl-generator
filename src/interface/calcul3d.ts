import type { Moteur } from '../moteur/client';
import { ErreurAnnulee, ErreurChargement } from '../moteur/erreurs';
import { MESSAGE_CALCUL_ECHOUE, MESSAGE_MOTEUR_ABSENT } from './messages';

export type Resultat3d =
  | { etat: 'calcul' }
  | { etat: 'pret'; corps: Uint8Array; etiquettes: Uint8Array | null }
  | { etat: 'erreur'; message: string };

export interface Calcul3d {
  /** Demande le rendu de ce .scad. Remplace toute demande précédente. */
  demander(scad: string, avecEtiquettes: boolean): void;
  /** Abandonne tout : plus aucun résultat ne sera livré. */
  arreter(): void;
}

/**
 * Lance les rendus 3D sans surcharger le moteur : on attend que l'utilisateur
 * ait fini de régler, et seul le résultat de la dernière demande est livré.
 */
export function creerCalcul3d(
  moteur: Moteur,
  surResultat: (r: Resultat3d) => void,
  delaiMs = 500,
): Calcul3d {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  // Numéro de la dernière demande : un rendu qui n'a plus ce numéro est périmé.
  let derniere = 0;

  async function rendre(numero: number, scad: string, avecEtiquettes: boolean): Promise<void> {
    moteur.annuler(); // on n'attend pas la fin d'un rendu devenu inutile
    surResultat({ etat: 'calcul' });
    try {
      const corps = await moteur.rendre(scad, 'corps');
      if (numero !== derniere) return;
      // OpenSCAD refuse de rendre une pièce vide : on ne la demande que s'il y a du texte.
      const etiquettes = avecEtiquettes ? await moteur.rendre(scad, 'etiquettes') : null;
      if (numero !== derniere) return;
      surResultat({ etat: 'pret', corps, etiquettes });
    } catch (e) {
      if (numero !== derniere || e instanceof ErreurAnnulee) return;
      surResultat({
        etat: 'erreur',
        message: e instanceof ErreurChargement ? MESSAGE_MOTEUR_ABSENT : MESSAGE_CALCUL_ECHOUE,
      });
    }
  }

  return {
    demander(scad, avecEtiquettes) {
      clearTimeout(minuterie);
      const numero = ++derniere;
      minuterie = setTimeout(() => void rendre(numero, scad, avecEtiquettes), delaiMs);
    },
    arreter() {
      clearTimeout(minuterie);
      derniere++;
      moteur.annuler();
    },
  };
}
