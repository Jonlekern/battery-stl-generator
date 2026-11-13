import { describe, expect, it } from 'vitest';
import { pileParId } from '../../src/catalogue';
import { caseDe, formesPossibles, hauteurTexte } from '../../src/placement/cases';
import { OPTIONS_DEFAUT as o } from '../../src/types';

const aa = pileParId('aa')!;
const neufVolts = pileParId('9v')!;
const cr2032 = pileParId('cr2032')!;
const d = pileParId('d')!;
const utile = { largeur: 299, profondeur: 399 };

describe('caseDe', () => {
  it('donne un pas carré aux piles cylindriques', () => {
    const c = caseDe(aa, o, false);
    expect(c.pasX).toBeCloseTo(16.1);
    expect(c.pasY).toBeCloseTo(16.1);
    expect(c.profondeurAlveole).toBeCloseTo(20.2);
    expect(c.hauteurZone).toBeCloseTo(22.2);
    expect(c.hauteurDebout).toBeCloseTo(50.5);
  });

  it('ignore la rotation pour une pile cylindrique', () => {
    expect(caseDe(aa, o, true)).toEqual(caseDe(aa, o, false));
  });

  it('donne un pas rectangulaire aux piles rectangulaires', () => {
    const c = caseDe(neufVolts, o, false);
    expect(c.pasX).toBeCloseTo(28.1);
    expect(c.pasY).toBeCloseTo(19.1);
    expect(c.hauteurZone).toBeCloseTo(21.4);
  });

  it('échange les pas quand la case est tournée', () => {
    const c = caseDe(neufVolts, o, true);
    expect(c.pasX).toBeCloseTo(19.1);
    expect(c.pasY).toBeCloseTo(28.1);
  });

  it('range les piles bouton sur la tranche, à 55 % du diamètre', () => {
    const c = caseDe(cr2032, o, false);
    expect(c.pasX).toBeCloseTo(21.6);
    expect(c.pasY).toBeCloseTo(4.8);
    expect(c.profondeurAlveole).toBeCloseTo(11);
    expect(c.hauteurZone).toBeCloseTo(13);
    expect(c.hauteurDebout).toBeCloseTo(20);
  });

  it('suit le réglage de profondeur pour les cylindriques, pas pour les boutons', () => {
    const profond = { ...o, profondeurPct: 60 };
    expect(caseDe(aa, profond, false).profondeurAlveole).toBeCloseTo(30.3);
    expect(caseDe(cr2032, profond, false).profondeurAlveole).toBeCloseTo(11);
  });
});

describe('formesPossibles', () => {
  const grilles = (formes: { colonnes: number; rangees: number }[]) =>
    formes.map((f) => `${f.colonnes}x${f.rangees}`);

  it('liste une forme par nombre de rangées pour 12 AA', () => {
    const formes = formesPossibles(aa, 12, o, utile);
    expect(grilles(formes)).toEqual(['1x12', '2x6', '3x4', '4x3', '6x2', '12x1']);
    const f43 = formes.find((f) => f.colonnes === 4)!;
    expect(f43.largeur).toBeCloseTo(65.6);
    expect(f43.profondeur).toBeCloseTo(57.5);
    expect(f43.tournee).toBe(false);
  });

  it('arrondit à une grille complète quand la quantité ne tombe pas juste', () => {
    expect(grilles(formesPossibles(aa, 7, o, utile))).toEqual(['1x7', '2x4', '3x3', '4x2', '7x1']);
  });

  it('ne compte pas la bande d\'étiquette quand les étiquettes sont désactivées', () => {
    const f43 = formesPossibles(aa, 12, { ...o, etiquettes: 'aucune' }, utile).find((f) => f.colonnes === 4)!;
    expect(f43.largeur).toBeCloseTo(65.6);
    expect(f43.profondeur).toBeCloseTo(49.5);
  });

  it('propose les deux orientations pour les piles non cylindriques', () => {
    const formes = formesPossibles(neufVolts, 2, o, utile);
    expect(formes.some((f) => f.tournee)).toBe(true);
    expect(formes.some((f) => !f.tournee)).toBe(true);
    // Les formes non tournées viennent d'abord.
    const premiereTournee = formes.findIndex((f) => f.tournee);
    expect(formes.slice(premiereTournee).every((f) => f.tournee)).toBe(true);
  });

  it('ne propose jamais de forme tournée pour une pile cylindrique', () => {
    expect(formesPossibles(aa, 12, o, utile).every((f) => !f.tournee)).toBe(true);
  });

  it('écarte les formes qui ne tiennent pas dans la surface utile', () => {
    const formes = formesPossibles(aa, 12, o, { largeur: 70, profondeur: 60 });
    expect(grilles(formes)).toEqual(['4x3']);
  });

  it('rend un tableau vide quand une seule alvéole ne rentre pas', () => {
    expect(formesPossibles(d, 1, o, { largeur: 29, profondeur: 29 })).toEqual([]);
  });

  it('rend un tableau vide pour une quantité nulle', () => {
    expect(formesPossibles(aa, 0, o, utile)).toEqual([]);
  });
});

describe('hauteurTexte', () => {
  it('plafonne le texte à 6 mm', () => {
    expect(hauteurTexte('AA', 65.6)).toBe(6);
    expect(hauteurTexte('CR2032', 40)).toBe(6);
  });

  it('réduit le texte pour qu\'il tienne dans la largeur', () => {
    expect(hauteurTexte('CR2032', 30)).toBeCloseTo(4.444, 2);
  });

  it('rend null quand le texte passerait sous 4 mm', () => {
    expect(hauteurTexte('CR2032', 22.8)).toBeNull();
  });
});
