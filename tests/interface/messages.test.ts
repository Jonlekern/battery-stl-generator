import { describe, expect, it } from 'vitest';
import {
  MESSAGE_CALCUL_ECHOUE,
  MESSAGE_MOTEUR_ABSENT,
  PIED_DE_PAGE,
  texteAvertissement,
  texteErreur,
} from '../../src/interface/messages';
import { demande, planOk } from '../aide/rendu';

describe('texteErreur', () => {
  it('nomme les piles qui ne rentrent pas', () => {
    expect(texteErreur({ code: 'ne_rentre_pas', pileIds: ['aa', '9v'] })).toBe(
      'Ça ne rentre pas dans le tiroir. Types à réduire ou à retirer : AA, 9V.',
    );
  });

  it('nomme le champ hors limites en français', () => {
    expect(texteErreur({ code: 'saisie', champ: 'tiroir.largeur' })).toBe('Valeur hors limites : largeur du tiroir.');
    expect(texteErreur({ code: 'saisie', champ: 'quantites.aa' })).toBe('Valeur hors limites : quantité de AA.');
    expect(texteErreur({ code: 'saisie', champ: 'options.profondeurPct' })).toBe(
      "Valeur hors limites : profondeur d'alvéole.",
    );
  });

  it('demande au moins une pile', () => {
    expect(texteErreur({ code: 'aucune_pile' })).toBe('Ajoute au moins une pile.');
  });
});

describe('texteAvertissement', () => {
  const d = demande({ quantites: { aa: 12 }, reste: { mode: 'usagees' } });
  const plan = planOk(d);

  it('donne les dimensions de l\'insert et du plateau', () => {
    expect(texteAvertissement({ code: 'plateau' }, plan, d)).toBe(
      "L'insert (299 × 399 mm) dépasse du plateau d'impression (256 × 256 mm).",
    );
  });

  it('donne la hauteur atteinte par la pile, avec une virgule', () => {
    expect(texteAvertissement({ code: 'hauteur', pileId: 'aa', hauteurTotale: 52.5 }, plan, d)).toBe(
      'La pile AA debout monte à 52,5 mm : elle dépasse la hauteur du tiroir.',
    );
  });

  it('signale une étiquette omise', () => {
    expect(texteAvertissement({ code: 'etiquette_omise', pileId: 'cr2032' }, plan, d)).toBe(
      "Zone CR2032 trop étroite : pas d'étiquette.",
    );
  });

  it('signale le bac impossible', () => {
    expect(texteAvertissement({ code: 'usagees_impossible' }, plan, d)).toBe(
      'Pas assez de place pour la zone « usagées ».',
    );
  });
});

describe('textes fixes', () => {
  it('sont ceux de la spec', () => {
    expect(MESSAGE_MOTEUR_ABSENT).toBe(
      "Le moteur 3D n'a pas pu se charger. Le plan 2D et le fichier .scad restent disponibles.",
    );
    expect(MESSAGE_CALCUL_ECHOUE).toBe('Le calcul 3D a échoué. Le dernier modèle valide reste affiché.');
    expect(PIED_DE_PAGE).toBe('Géométrie calculée par OpenSCAD, logiciel libre sous licence GPL.');
  });
});
