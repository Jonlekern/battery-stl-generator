import { describe, expect, it } from 'vitest';
import { genererScad } from '../../src/scad/generer';
import { OPTIONS_DEFAUT } from '../../src/types';
import { demande, planOk } from '../aide/rendu';

describe('genererScad', () => {
  const d = demande({ quantites: { aa: 12 } });
  const scad = genererScad(planOk(d), d);

  it('écrit les paramètres en tête de fichier', () => {
    expect(scad).toContain('piece = "tout";');
    expect(scad).toContain('fond = 2; jeu = 0.4; paroi = 1.2;');
    expect(scad).toContain('mode_etiquettes = "relief";');
    expect(scad).toContain('encoches = true;');
    expect(scad).toContain('insert = [65.6, 57.5];');
  });

  it('écrit une ligne par zone, avec des nombres propres', () => {
    expect(scad).toContain(
      '  ["cyl", 0, 0, 65.6, 57.5, 22.2, 4, 3, false, 16.1, 16.1, 14.5, 0, 20.2, "AA", 6],',
    );
  });

  it('ajoute la bibliothèque après les paramètres', () => {
    expect(scad).toContain('module insert()');
    expect(scad.indexOf('zones = [')).toBeLessThan(scad.indexOf('module insert()'));
  });

  it('suit les options de la demande', () => {
    const d2 = demande({
      quantites: { aa: 12 },
      options: { ...OPTIONS_DEFAUT, jeu: 0.25, etiquettes: 'grave', encoches: false },
    });
    const s = genererScad(planOk(d2), d2);
    expect(s).toContain('fond = 2; jeu = 0.25; paroi = 1.2;');
    expect(s).toContain('mode_etiquettes = "grave";');
    expect(s).toContain('encoches = false;');
  });

  it('décrit les piles rectangulaires et les piles bouton', () => {
    const d2 = demande({ quantites: { '9v': 2, cr2032: 6 } });
    const s = genererScad(planOk(d2), d2);
    expect(s).toMatch(/\["rect", .*, 26\.5, 17\.5, 19\.4, "9V", /);
    expect(s).toMatch(/\["bouton", .*, 20, 3\.2, 11, /);
  });

  it('décrit le bac des piles usagées', () => {
    const d2 = demande({ quantites: { aa: 12 }, reste: { mode: 'usagees' } });
    const s = genererScad(planOk(d2), d2);
    expect(s).toContain('insert = [299, 399];');
    expect(s).toMatch(/\["bac", .*, 0, 0, false, 0, 0, 0, 0, 20\.2, "USAGÉES", 6\],/);
  });

  it('écrit un texte vide et une hauteur nulle pour une zone sans étiquette', () => {
    const d2 = demande({ quantites: { cr2032: 1 } });
    expect(genererScad(planOk(d2), d2)).toMatch(/\["bouton", .*, "", 0\],/);
  });

  it('échappe les guillemets et les barres obliques inverses du texte', () => {
    const plan = planOk(d);
    plan.zones[0].etiquette = { texte: 'A"B\\C', hauteurTexte: 6 };
    expect(genererScad(plan, d)).toContain('"A\\"B\\\\C", 6],');
  });
});
