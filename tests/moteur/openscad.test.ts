import { describe, expect, it } from 'vitest';
import { boiteEnglobante, estFerme, lireStl, nombreTriangles, volume } from '../../src/export/stl';
import { ErreurOpenScad, rendre } from '../../src/moteur/openscad';
import { chargerPolice } from '../aide/police';

const DELAI = 60_000;
const police = chargerPolice();

describe('moteur OpenSCAD', () => {
  it('rend un cube en maillage fermé de 12 triangles', async () => {
    const m = lireStl(await rendre('cube(10);', 'tout', police));
    expect(nombreTriangles(m)).toBe(12);
    const b = boiteEnglobante(m);
    expect(b.min).toEqual([0, 0, 0]);
    expect(b.max).toEqual([10, 10, 10]);
    expect(volume(m)).toBeCloseTo(1000, 2);
    expect(estFerme(m)).toBe(true);
  }, DELAI);

  it('transmet la pièce demandée au fichier .scad', async () => {
    const scad = 'piece="tout"; if (piece=="corps") cube(5); else cube(10);';
    expect(boiteEnglobante(lireStl(await rendre(scad, 'corps', police))).max).toEqual([5, 5, 5]);
    expect(boiteEnglobante(lireStl(await rendre(scad, 'tout', police))).max).toEqual([10, 10, 10]);
  }, DELAI);

  it('rend du texte avec la police Liberation Sans, accents compris', async () => {
    const texte = (t: string) =>
      `linear_extrude(1) text("${t}", size=6, font="Liberation Sans:style=Bold");`;
    const avecAccent = nombreTriangles(lireStl(await rendre(texte('É'), 'tout', police)));
    const sansAccent = nombreTriangles(lireStl(await rendre(texte('E'), 'tout', police)));
    expect(sansAccent).toBeGreaterThan(0);
    expect(avecAccent).toBeGreaterThan(sansAccent);
  }, DELAI);

  it('rejette une erreur de syntaxe avec le journal d\'OpenSCAD', async () => {
    const erreur = await rendre('cube(5', 'tout', police).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurOpenScad);
    expect((erreur as ErreurOpenScad).journal.some((l) => l.includes('Parser error'))).toBe(true);
  }, DELAI);
});
