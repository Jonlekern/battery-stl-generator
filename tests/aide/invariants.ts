import { expect } from 'vitest';
import { nombreAlveoles } from '../../src/placement';
import { C, type Demande, type PlanOk, type Zone } from '../../src/types';

const EPS = 1e-6;

function seChevauchent(a: Zone, b: Zone): boolean {
  return (
    a.x < b.x + b.largeur - EPS &&
    b.x < a.x + a.largeur - EPS &&
    a.y < b.y + b.profondeur - EPS &&
    b.y < a.y + a.profondeur - EPS
  );
}

/** Propriétés que tout plan valide doit respecter. */
export function verifierInvariants(plan: PlanOk, d: Demande): void {
  const { insert, zones } = plan;

  // L'insert tient dans la surface utile du tiroir.
  expect(insert.largeur).toBeLessThanOrEqual(d.tiroir.largeur - C.JEU_TIROIR + EPS);
  expect(insert.profondeur).toBeLessThanOrEqual(d.tiroir.profondeur - C.JEU_TIROIR + EPS);

  // Chaque zone est dans l'insert.
  for (const z of zones) {
    expect(z.x).toBeGreaterThanOrEqual(-EPS);
    expect(z.y).toBeGreaterThanOrEqual(-EPS);
    expect(z.x + z.largeur).toBeLessThanOrEqual(insert.largeur + EPS);
    expect(z.y + z.profondeur).toBeLessThanOrEqual(insert.profondeur + EPS);
    expect(z.hauteur).toBeGreaterThan(d.options.fond);
  }

  // Aucune zone n'en chevauche une autre.
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      expect(seChevauchent(zones[i], zones[j]), `zones ${i} et ${j}`).toBe(false);
    }
  }

  // Chaque type demandé a au moins le nombre d'alvéoles demandé.
  for (const [pileId, quantite] of Object.entries(d.quantites)) {
    if (quantite === 0) continue;
    const alveoles = zones
      .filter((z) => z.genre === 'piles' && z.pileId === pileId)
      .reduce((n, z) => n + nombreAlveoles(z), 0);
    expect(alveoles, pileId).toBeGreaterThanOrEqual(quantite);
  }

  // La hauteur de l'insert est celle de sa zone la plus haute.
  expect(insert.hauteur).toBeCloseTo(Math.max(...zones.map((z) => z.hauteur)));
}
