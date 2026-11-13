import { describe, expect, it } from 'vitest';
import { boiteEnglobante, estFerme, volume } from '../../src/export/stl';
import { aDesEtiquettes } from '../../src/scad/generer';
import { OPTIONS_DEFAUT } from '../../src/types';
import { demande, planOk, rendreDemande } from '../aide/rendu';

const DELAI = 120_000;
const relief = demande({ quantites: { aa: 12 } });
const grave = demande({ quantites: { aa: 12 }, options: { ...OPTIONS_DEFAUT, etiquettes: 'grave' } });

const ecartRelatif = (a: number, b: number) => Math.abs(a - b) / b;

describe('étiquettes en relief', () => {
  it('pose le texte sur la bande avant de la zone', async () => {
    const b = boiteEnglobante(await rendreDemande(relief, 'etiquettes'));
    expect(b.min[2]).toBeCloseTo(22.2, 2);
    expect(b.max[2]).toBeCloseTo(22.8, 2);
    expect(b.min[1]).toBeGreaterThanOrEqual(0);
    expect(b.max[1]).toBeLessThanOrEqual(8);
    expect(b.min[0]).toBeGreaterThanOrEqual(0);
    expect(b.max[0]).toBeLessThanOrEqual(65.6);
    // Texte « AA » de 6 mm de haut, centré dans la bande.
    expect(b.max[1] - b.min[1]).toBeGreaterThan(5);
    expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(32.8, 0);
  }, DELAI);

  it('réunit le corps et les étiquettes dans la pièce « tout »', async () => {
    const [corps, etiquettes, tout] = await Promise.all([
      rendreDemande(relief, 'corps'),
      rendreDemande(relief, 'etiquettes'),
      rendreDemande(relief, 'tout'),
    ]);
    expect(estFerme(tout)).toBe(true);
    expect(volume(etiquettes)).toBeGreaterThan(1);
    expect(ecartRelatif(volume(tout), volume(corps) + volume(etiquettes))).toBeLessThan(0.005);
    expect(boiteEnglobante(tout).max[2]).toBeCloseTo(22.8, 2);
  }, DELAI);

  it('pose l\'étiquette « USAGÉES » sur le fond du bac', async () => {
    const d = demande({ quantites: { aa: 12 }, reste: { mode: 'usagees' } });
    const b = boiteEnglobante(await rendreDemande(d, 'etiquettes'));
    expect(b.min[2]).toBeCloseTo(2, 2);
    expect(b.max[2]).toBeCloseTo(22.8, 2);
  }, DELAI);
});

describe('étiquettes gravées', () => {
  it('place le texte dans les 0,6 mm sous la surface', async () => {
    const b = boiteEnglobante(await rendreDemande(grave, 'etiquettes'));
    expect(b.min[2]).toBeCloseTo(21.6, 2);
    expect(b.max[2]).toBeCloseTo(22.2, 2);
  }, DELAI);

  it('retire du corps exactement le volume du texte', async () => {
    const [corpsGrave, texte, corpsRelief, toutGrave] = await Promise.all([
      rendreDemande(grave, 'corps'),
      rendreDemande(grave, 'etiquettes'),
      rendreDemande(relief, 'corps'),
      rendreDemande(grave, 'tout'),
    ]);
    expect(estFerme(corpsGrave)).toBe(true);
    expect(volume(corpsGrave)).toBeLessThan(volume(corpsRelief));
    expect(ecartRelatif(volume(corpsGrave) + volume(texte), volume(corpsRelief))).toBeLessThan(0.005);
    // En mode gravé, la pièce « tout » est le corps gravé, sans remplissage.
    expect(volume(toutGrave)).toBeCloseTo(volume(corpsGrave), 3);
    expect(boiteEnglobante(toutGrave).max[2]).toBeCloseTo(22.2, 2);
  }, DELAI);
});

describe('aDesEtiquettes', () => {
  it('est vrai quand au moins une zone a une étiquette', () => {
    expect(aDesEtiquettes(planOk(relief))).toBe(true);
  });

  it('est faux quand les étiquettes sont désactivées', () => {
    const d = demande({ quantites: { aa: 12 }, options: { ...OPTIONS_DEFAUT, etiquettes: 'aucune' } });
    expect(aDesEtiquettes(planOk(d))).toBe(false);
  });

  it.each(['relief', 'grave'] as const)(
    'est faux quand toutes les zones sont trop étroites, et le rendu réussit (%s)',
    async (etiquettes) => {
      const d = demande({ quantites: { cr2032: 1 }, options: { ...OPTIONS_DEFAUT, etiquettes } });
      expect(aDesEtiquettes(planOk(d))).toBe(false);
      const [corps, tout] = await Promise.all([rendreDemande(d, 'corps'), rendreDemande(d, 'tout')]);
      expect(estFerme(corps)).toBe(true);
      expect(volume(tout)).toBeCloseTo(volume(corps), 3);
    },
    DELAI,
  );
});
