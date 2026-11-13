import type { Pile } from './types';

const cyl = (id: string, nom: string, libelle: string, diametre: number, hauteur: number): Pile => ({
  id,
  nom,
  libelle,
  famille: 'cylindrique',
  diametre,
  hauteur,
});

const rect = (
  id: string,
  nom: string,
  libelle: string,
  longueur: number,
  largeur: number,
  hauteur: number,
): Pile => ({ id, nom, libelle, famille: 'rectangulaire', longueur, largeur, hauteur });

const bouton = (id: string, nom: string, libelle: string, diametre: number, epaisseur: number): Pile => ({
  id,
  nom,
  libelle,
  famille: 'bouton',
  diametre,
  epaisseur,
});

/**
 * Piles courantes du commerce. Dimensions nominales maximales, en millimètres.
 * Ajouter une pile, c'est ajouter une ligne ici : rien d'autre ne change.
 */
export const PILES: Pile[] = [
  // Cylindriques : diamètre × hauteur
  cyl('aaaa', 'AAAA', 'AAAA (LR61)', 8.3, 42.5),
  cyl('aaa', 'AAA', 'AAA (LR03)', 10.5, 44.5),
  cyl('aa', 'AA', 'AA (LR6)', 14.5, 50.5),
  cyl('c', 'C', 'C (LR14)', 26.2, 50.0),
  cyl('d', 'D', 'D (LR20)', 34.2, 61.5),
  cyl('n', 'N', 'N (LR1)', 12.0, 30.2),
  cyl('a23', 'A23', 'A23 (12 V)', 10.3, 28.5),
  cyl('a27', 'A27', 'A27 (12 V)', 8.0, 28.2),
  cyl('4lr44', '4LR44', '4LR44 (6 V)', 13.0, 25.2),
  cyl('cr2', 'CR2', 'CR2', 15.6, 27.0),
  cyl('cr123a', 'CR123A', 'CR123A', 17.0, 34.5),
  cyl('14500', '14500', '14500 (Li-ion)', 14.5, 50.5),
  cyl('16340', '16340', '16340 (Li-ion)', 17.0, 34.5),
  cyl('18650', '18650', '18650 (Li-ion)', 18.6, 65.2),
  cyl('21700', '21700', '21700 (Li-ion)', 21.7, 70.9),

  // Rectangulaires : longueur × largeur × hauteur
  rect('9v', '9V', '9V (6LR61)', 26.5, 17.5, 48.5),
  rect('4v5', '4,5V', '4,5V plate (3LR12)', 62.0, 22.0, 67.0),

  // Boutons : diamètre × épaisseur
  bouton('cr2032', 'CR2032', 'CR2032', 20.0, 3.2),
  bouton('cr2025', 'CR2025', 'CR2025', 20.0, 2.5),
  bouton('cr2016', 'CR2016', 'CR2016', 20.0, 1.6),
  bouton('cr2450', 'CR2450', 'CR2450', 24.5, 5.0),
  bouton('cr2430', 'CR2430', 'CR2430', 24.5, 3.0),
  bouton('cr1632', 'CR1632', 'CR1632', 16.0, 3.2),
  bouton('cr1620', 'CR1620', 'CR1620', 16.0, 2.0),
  bouton('cr1616', 'CR1616', 'CR1616', 16.0, 1.6),
  bouton('cr1225', 'CR1225', 'CR1225', 12.5, 2.5),
  bouton('cr1220', 'CR1220', 'CR1220', 12.5, 2.0),
  bouton('lr44', 'LR44', 'LR44 (AG13, 357)', 11.6, 5.4),
  bouton('lr43', 'LR43', 'LR43 (AG12, 386)', 11.6, 4.2),
  bouton('lr1130', 'LR1130', 'LR1130 (AG10, 389)', 11.6, 3.1),
  bouton('lr41', 'LR41', 'LR41 (AG3, 392)', 7.9, 3.6),
  bouton('sr920sw', 'SR920SW', 'SR920SW (371)', 9.5, 2.1),
  bouton('sr626sw', 'SR626SW', 'SR626SW (377)', 6.8, 2.6),
  bouton('sr621sw', 'SR621SW', 'SR621SW (364)', 6.8, 2.15),
  bouton('aud675', '675', 'Auditive 675', 11.6, 5.4),
  bouton('aud13', '13', 'Auditive 13', 7.9, 5.4),
  bouton('aud312', '312', 'Auditive 312', 7.9, 3.6),
  bouton('aud10', '10', 'Auditive 10', 5.8, 3.6),
];

const PAR_ID = new Map(PILES.map((p) => [p.id, p]));

export function pileParId(id: string): Pile | undefined {
  return PAR_ID.get(id);
}
