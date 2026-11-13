import { pileParId } from '../catalogue';
import type { Avertissement, Demande, Erreur, PlanOk } from '../types';
import { ecrireNombre } from './saisie';

export const MESSAGE_MOTEUR_ABSENT =
  "Le moteur 3D n'a pas pu se charger. Le plan 2D et le fichier .scad restent disponibles.";
export const MESSAGE_CALCUL_ECHOUE = 'Le calcul 3D a échoué. Le dernier modèle valide reste affiché.';
export const PIED_DE_PAGE = 'Géométrie calculée par OpenSCAD, logiciel libre sous licence GPL.';
export const LIEN_OPENSCAD = 'https://github.com/openscad/openscad';

const CHAMPS: Record<string, string> = {
  'tiroir.largeur': 'largeur du tiroir',
  'tiroir.profondeur': 'profondeur du tiroir',
  'tiroir.hauteur': 'hauteur du tiroir',
  'plateau.largeur': 'largeur du plateau',
  'plateau.profondeur': 'profondeur du plateau',
  'reste.pileId': 'type de pile à ajouter',
  'options.jeu': 'jeu',
  'options.fond': 'épaisseur du fond',
  'options.paroi': 'paroi minimale',
  'options.profondeurPct': "profondeur d'alvéole",
};

const nomPile = (id: string) => pileParId(id)?.nom ?? id;

function libelleChamp(champ: string): string {
  if (champ.startsWith('quantites.')) return `quantité de ${nomPile(champ.slice('quantites.'.length))}`;
  return CHAMPS[champ] ?? champ;
}

export function texteErreur(e: Erreur): string {
  switch (e.code) {
    case 'ne_rentre_pas':
      return `Ça ne rentre pas dans le tiroir. Types à réduire ou à retirer : ${e.pileIds.map(nomPile).join(', ')}.`;
    case 'saisie':
      return `Valeur hors limites : ${libelleChamp(e.champ)}.`;
    case 'aucune_pile':
      return 'Ajoute au moins une pile.';
  }
}

export function texteAvertissement(a: Avertissement, plan: PlanOk, d: Demande): string {
  const mm = (v: number) => ecrireNombre(v);
  switch (a.code) {
    case 'plateau':
      return (
        `L'insert (${mm(plan.insert.largeur)} × ${mm(plan.insert.profondeur)} mm) dépasse du plateau ` +
        `d'impression (${mm(d.plateau.largeur)} × ${mm(d.plateau.profondeur)} mm).`
      );
    case 'hauteur':
      return `La pile ${nomPile(a.pileId)} debout monte à ${mm(a.hauteurTotale)} mm : elle dépasse la hauteur du tiroir.`;
    case 'etiquette_omise':
      return `Zone ${nomPile(a.pileId)} trop étroite : pas d'étiquette.`;
    case 'usagees_impossible':
      return 'Pas assez de place pour la zone « usagées ».';
  }
}
