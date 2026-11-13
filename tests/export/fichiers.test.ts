import { describe, expect, it } from 'vitest';
import { nomFichier } from '../../src/export/fichiers';
import type { PlanOk } from '../../src/types';

const plan = (largeur: number, profondeur: number): PlanOk => ({
  ok: true,
  insert: { largeur, profondeur, hauteur: 22.2 },
  zones: [],
  avertissements: [],
});

describe('nomFichier', () => {
  it('reprend les dimensions de l\'insert, arrondies au millimètre', () => {
    expect(nomFichier(plan(65.6, 57.5), 'stl')).toBe('insert-piles-66x58.stl');
    expect(nomFichier(plan(65.6, 57.5), '3mf')).toBe('insert-piles-66x58.3mf');
    expect(nomFichier(plan(299, 399), 'scad')).toBe('insert-piles-299x399.scad');
  });
});
