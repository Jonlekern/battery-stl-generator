import { describe, expect, it } from 'vitest';
import { boiteEnglobante, estFerme, lireStl, nombreTriangles, volume } from '../../src/export/stl';
import { TETRAEDRE, fabriquerStl } from '../aide/stl';

describe('lecture STL', () => {
  const unTriangle = fabriquerStl([[[1, 2, 3], [4, 2, 3], [1, 6, 5]]]);

  it('lit les triangles d\'un STL binaire', () => {
    const m = lireStl(unTriangle);
    expect(nombreTriangles(m)).toBe(1);
    expect(Array.from(m.positions)).toEqual([1, 2, 3, 4, 2, 3, 1, 6, 5]);
  });

  it('calcule la boîte englobante', () => {
    expect(boiteEnglobante(lireStl(unTriangle))).toEqual({ min: [1, 2, 3], max: [4, 6, 5] });
  });

  it('dit qu\'un triangle seul n\'est pas un maillage fermé', () => {
    expect(estFerme(lireStl(unTriangle))).toBe(false);
  });

  it('reconnaît un tétraèdre fermé et calcule son volume', () => {
    const m = lireStl(fabriquerStl(TETRAEDRE));
    expect(estFerme(m)).toBe(true);
    expect(volume(m)).toBeCloseTo(1 / 6, 6);
  });

  it('refuse un fichier trop court', () => {
    expect(() => lireStl(new Uint8Array(83))).toThrow();
  });

  it('refuse un fichier dont la taille ne correspond pas au nombre de triangles annoncé', () => {
    const faux = fabriquerStl(TETRAEDRE);
    new DataView(faux.buffer).setUint32(80, 9, true);
    expect(() => lireStl(faux)).toThrow();
  });

  it('refuse la boîte englobante d\'un maillage vide', () => {
    expect(() => boiteEnglobante(lireStl(fabriquerStl([])))).toThrow();
  });
});
