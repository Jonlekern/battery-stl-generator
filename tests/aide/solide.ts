import type { Maillage } from '../../src/export/stl';

/**
 * Vrai si le point est dans la matière d'un maillage fermé.
 * Lance un rayon vers le haut et compte les faces traversées.
 */
export function estDansLaMatiere(m: Maillage, point: [number, number, number]): boolean {
  // Décalage infime pour ne pas tomber pile sur une arête.
  const px = point[0] + 1.37e-4;
  const py = point[1] + 2.11e-4;
  const pz = point[2];
  const p = m.positions;
  let traversees = 0;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2];
    const bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
    const cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) continue; // face verticale
    const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
    const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
    const w = 1 - u - v;
    if (u < 0 || v < 0 || w < 0) continue;
    if (u * az + v * bz + w * cz > pz) traversees++;
  }
  return traversees % 2 === 1;
}
