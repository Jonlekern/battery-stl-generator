import { describe, expect, it } from 'vitest';
import { PILES, pileParId } from '../src/catalogue';

describe('catalogue', () => {
  it('contient 38 piles : 15 cylindriques, 2 rectangulaires, 21 boutons', () => {
    expect(PILES).toHaveLength(38);
    const compte = (f: string) => PILES.filter((p) => p.famille === f).length;
    expect(compte('cylindrique')).toBe(15);
    expect(compte('rectangulaire')).toBe(2);
    expect(compte('bouton')).toBe(21);
  });

  it('a des identifiants uniques, en minuscules, sans espace', () => {
    const ids = PILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('a des dimensions strictement positives', () => {
    for (const p of PILES) {
      const dims =
        p.famille === 'cylindrique'
          ? [p.diametre, p.hauteur]
          : p.famille === 'rectangulaire'
            ? [p.longueur, p.largeur, p.hauteur]
            : [p.diametre, p.epaisseur];
      for (const d of dims) expect(d, p.id).toBeGreaterThan(0);
    }
  });

  it('a des noms d\'étiquette de 7 caractères au plus et un libellé', () => {
    for (const p of PILES) {
      expect(p.nom.length, p.id).toBeGreaterThan(0);
      expect(p.nom.length, p.id).toBeLessThanOrEqual(7);
      expect(p.libelle.length, p.id).toBeGreaterThan(0);
    }
  });

  it('retrouve une pile par son identifiant', () => {
    expect(pileParId('aa')).toMatchObject({ famille: 'cylindrique', diametre: 14.5, hauteur: 50.5 });
    expect(pileParId('9v')).toMatchObject({
      famille: 'rectangulaire',
      longueur: 26.5,
      largeur: 17.5,
      hauteur: 48.5,
    });
    expect(pileParId('cr2032')).toMatchObject({ famille: 'bouton', diametre: 20, epaisseur: 3.2 });
    expect(pileParId('inconnue')).toBeUndefined();
  });
});
