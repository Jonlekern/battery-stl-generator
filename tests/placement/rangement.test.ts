import { describe, expect, it } from 'vitest';
import { PILES, pileParId } from '../../src/catalogue';
import { formesPossibles } from '../../src/placement/cases';
import { ranger, type Candidat, type Placee } from '../../src/placement/rangement';
import { OPTIONS_DEFAUT as o } from '../../src/types';

const utile = { largeur: 299, profondeur: 399 };

function candidat(id: string, quantite: number, surface = utile): Candidat {
  return { pileId: id, formes: formesPossibles(pileParId(id)!, quantite, o, surface) };
}

function seChevauchent(a: Placee, b: Placee): boolean {
  const eps = 1e-6;
  return (
    a.x < b.x + b.forme.largeur - eps &&
    b.x < a.x + a.forme.largeur - eps &&
    a.y < b.y + b.forme.profondeur - eps &&
    b.y < a.y + a.forme.profondeur - eps
  );
}

describe('ranger', () => {
  it('choisit la grille la plus proche du carré pour un seul type', () => {
    const r = ranger([candidat('aa', 12)], utile);
    if (!r.ok) throw new Error('devrait rentrer');
    expect(r.placees).toHaveLength(1);
    expect(r.placees[0]).toMatchObject({ pileId: 'aa', x: 0, y: 0 });
    expect(r.placees[0].forme).toMatchObject({ colonnes: 4, rangees: 3 });
    expect(r.largeur).toBeCloseTo(65.6);
    expect(r.profondeur).toBeCloseTo(57.5);
    expect(r.etageres).toHaveLength(1);
    expect(r.etageres[0].y).toBe(0);
    expect(r.etageres[0].profondeur).toBeCloseTo(57.5);
    expect(r.etageres[0].xFin).toBeCloseTo(65.6);
  });

  it('range plusieurs types sans chevauchement, dans la surface utile', () => {
    const r = ranger(
      [candidat('aa', 8), candidat('aaa', 8), candidat('9v', 2), candidat('cr2032', 6)],
      utile,
    );
    if (!r.ok) throw new Error('devrait rentrer');
    expect(r.placees).toHaveLength(4);
    for (const p of r.placees) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.forme.largeur).toBeLessThanOrEqual(utile.largeur + 1e-6);
      expect(p.y + p.forme.profondeur).toBeLessThanOrEqual(utile.profondeur + 1e-6);
    }
    for (let i = 0; i < r.placees.length; i++) {
      for (let j = i + 1; j < r.placees.length; j++) {
        expect(seChevauchent(r.placees[i], r.placees[j]), `${i} et ${j}`).toBe(false);
      }
    }
    expect(r.largeur).toBeLessThanOrEqual(utile.largeur + 1e-6);
    expect(r.profondeur).toBeLessThanOrEqual(utile.profondeur + 1e-6);
  });

  it('passe à une nouvelle étagère quand la largeur est dépassée', () => {
    // Les deux zones les plus étroites font 17,3 + 13,3 = 30,6 mm : trop pour 30 mm.
    const etroit = { largeur: 30, profondeur: 399 };
    const r = ranger([candidat('aa', 12, etroit), candidat('aaa', 12, etroit)], etroit);
    if (!r.ok) throw new Error('devrait rentrer');
    expect(r.etageres).toHaveLength(2);
    expect(r.etageres[1].y).toBeCloseTo(r.etageres[0].profondeur);
    expect(r.largeur).toBeLessThanOrEqual(30 + 1e-6);
  });

  it('rend toujours le même résultat pour la même entrée', () => {
    const entree = () => [candidat('aa', 8), candidat('aaa', 8), candidat('9v', 2)];
    expect(ranger(entree(), utile)).toEqual(ranger(entree(), utile));
  });

  it('ne dépend pas de l\'ordre des candidats', () => {
    const a = ranger([candidat('aa', 8), candidat('9v', 2), candidat('cr2032', 6)], utile);
    const b = ranger([candidat('cr2032', 6), candidat('aa', 8), candidat('9v', 2)], utile);
    expect(a).toEqual(b);
  });

  it('signale la pile dont une seule alvéole ne rentre pas', () => {
    const petit = { largeur: 29, profondeur: 29 };
    expect(ranger([candidat('d', 1, petit)], petit)).toEqual({ ok: false, nonPlaces: ['d'] });
  });

  it('signale le type qui déborde de la surface', () => {
    const petit = { largeur: 99, profondeur: 99 };
    expect(ranger([candidat('aa', 500, petit)], petit)).toEqual({ ok: false, nonPlaces: ['aa'] });
  });

  it('ne signale que les types qui ne rentrent pas', () => {
    const petit = { largeur: 99, profondeur: 99 };
    const r = ranger([candidat('aaa', 4, petit), candidat('d', 30, petit)], petit);
    expect(r).toEqual({ ok: false, nonPlaces: ['d'] });
  });

  it('rend un rangement vide quand il n\'y a aucun candidat', () => {
    expect(ranger([], utile)).toEqual({ ok: true, placees: [], etageres: [], largeur: 0, profondeur: 0 });
  });

  it('répond en moins d\'une seconde avec 500 piles de chaque type', () => {
    const grand = { largeur: 999, profondeur: 999 };
    const candidats = PILES.map((p) => candidat(p.id, 500, grand));
    const debut = performance.now();
    ranger(candidats, grand);
    expect(performance.now() - debut).toBeLessThan(1000);
  });
});
