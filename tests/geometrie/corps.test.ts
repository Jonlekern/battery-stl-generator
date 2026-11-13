import { describe, expect, it } from 'vitest';
import { boiteEnglobante, estFerme, volume, type Maillage } from '../../src/export/stl';
import { OPTIONS_DEFAUT, type PlanOk } from '../../src/types';
import { demande, planOk, rendreDemande } from '../aide/rendu';

const DELAI = 120_000;
const sansEtiquettes = { ...OPTIONS_DEFAUT, etiquettes: 'aucune' as const };

function attendreBoite(m: Maillage, plan: PlanOk): void {
  const b = boiteEnglobante(m);
  expect(b.min[0]).toBeCloseTo(0, 2);
  expect(b.min[1]).toBeCloseTo(0, 2);
  expect(b.min[2]).toBeCloseTo(0, 2);
  expect(b.max[0]).toBeCloseTo(plan.insert.largeur, 2);
  expect(b.max[1]).toBeCloseTo(plan.insert.profondeur, 2);
  expect(b.max[2]).toBeCloseTo(plan.insert.hauteur, 2);
}

describe('géométrie du corps', () => {
  it('perce 12 alvéoles cylindriques aux bonnes dimensions', async () => {
    const d = demande({ quantites: { aa: 12 }, options: sansEtiquettes });
    const m = await rendreDemande(d, 'corps');
    const b = boiteEnglobante(m);
    expect(b.max[0]).toBeCloseTo(65.6, 2);
    expect(b.max[1]).toBeCloseTo(49.5, 2);
    expect(b.max[2]).toBeCloseTo(22.2, 2);
    expect(estFerme(m)).toBe(true);
    // Bloc plein moins 12 cylindres de diamètre 14,9 et de profondeur 20,2.
    const attendu = 65.6 * 49.5 * 22.2 - 12 * Math.PI * 7.45 ** 2 * 20.2;
    expect(Math.abs(volume(m) - attendu) / attendu).toBeLessThan(0.015);
  }, DELAI);

  it('creuse des poches rectangulaires pour les 9V', async () => {
    const d = demande({ quantites: { '9v': 2 }, options: { ...sansEtiquettes, encoches: false } });
    const plan = planOk(d);
    const m = await rendreDemande(d, 'corps');
    attendreBoite(m, plan);
    expect(estFerme(m)).toBe(true);
    const bloc = plan.insert.largeur * plan.insert.profondeur * plan.insert.hauteur;
    const attendu = bloc - 2 * 26.9 * 17.9 * 19.4;
    expect(Math.abs(volume(m) - attendu) / attendu).toBeLessThan(0.04);
  }, DELAI);

  it('creuse des fentes pour les piles bouton', async () => {
    const d = demande({ quantites: { cr2032: 6 }, options: { ...OPTIONS_DEFAUT, encoches: false } });
    const plan = planOk(d);
    const m = await rendreDemande(d, 'corps');
    attendreBoite(m, plan);
    expect(estFerme(m)).toBe(true);
    const bloc = plan.insert.largeur * plan.insert.profondeur * plan.insert.hauteur;
    // 6 fentes d'au moins 3,6 × 20,4 mm sur la moitié haute : au moins 6 × 3,6 × 20,4 × 0,8 mm³.
    expect(volume(m)).toBeLessThan(bloc - 6 * 3.6 * 20.4 * 0.8);
    expect(volume(m)).toBeGreaterThan(bloc * 0.5);
  }, DELAI);

  it('assemble plusieurs zones de hauteurs différentes', async () => {
    const d = demande({ quantites: { aa: 8, aaa: 8, '9v': 2, cr2032: 6 } });
    const plan = planOk(d);
    const m = await rendreDemande(d, 'corps');
    attendreBoite(m, plan);
    expect(estFerme(m)).toBe(true);
    expect(volume(m)).toBeLessThan(plan.insert.largeur * plan.insert.profondeur * plan.insert.hauteur);
  }, DELAI);

  it('remplit le tiroir et creuse le bac en mode « usagées »', async () => {
    const d = demande({ quantites: { aa: 12 }, reste: { mode: 'usagees' } });
    const plan = planOk(d);
    const m = await rendreDemande(d, 'corps');
    attendreBoite(m, plan);
    expect(plan.insert.largeur).toBeCloseTo(299);
    expect(plan.insert.profondeur).toBeCloseTo(399);
    expect(estFerme(m)).toBe(true);
    // Le bac est creux : bien moins de matière qu'un bloc plein de 22,2 mm.
    expect(volume(m)).toBeLessThan(299 * 399 * 22.2 * 0.25);
    // Mais la plaque de fond couvre tout l'insert.
    expect(volume(m)).toBeGreaterThan(299 * 399 * 2);
  }, DELAI);
});
