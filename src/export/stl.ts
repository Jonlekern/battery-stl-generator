/** Maillage triangulé : 9 nombres par triangle (3 sommets × x, y, z). */
export interface Maillage {
  positions: Float32Array;
}

const ENTETE = 84;
const OCTETS_PAR_TRIANGLE = 50;

/** Lit un STL binaire. Lève une erreur si le fichier est tronqué ou incohérent. */
export function lireStl(octets: Uint8Array): Maillage {
  if (octets.byteLength < ENTETE) {
    throw new Error('STL invalide : fichier trop court');
  }
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const n = vue.getUint32(80, true);
  if (octets.byteLength !== ENTETE + n * OCTETS_PAR_TRIANGLE) {
    throw new Error('STL invalide : la taille ne correspond pas au nombre de triangles');
  }
  const positions = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) {
    const debut = ENTETE + t * OCTETS_PAR_TRIANGLE + 12; // on saute la normale
    for (let k = 0; k < 9; k++) {
      positions[t * 9 + k] = vue.getFloat32(debut + k * 4, true);
    }
  }
  return { positions };
}

export function nombreTriangles(m: Maillage): number {
  return m.positions.length / 9;
}

export function boiteEnglobante(m: Maillage): {
  min: [number, number, number];
  max: [number, number, number];
} {
  if (m.positions.length === 0) {
    throw new Error('Maillage vide : pas de boîte englobante');
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i++) {
    const axe = i % 3;
    const v = m.positions[i];
    if (v < min[axe]) min[axe] = v;
    if (v > max[axe]) max[axe] = v;
  }
  return { min, max };
}

/** Volume d'un maillage fermé : somme des volumes signés des tétraèdres. */
export function volume(m: Maillage): number {
  const p = m.positions;
  let six = 0;
  for (let i = 0; i < p.length; i += 9) {
    six +=
      p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) -
      p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) +
      p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6]);
  }
  return Math.abs(six) / 6;
}

/**
 * Vrai si chaque arête appartient à exactement deux triangles, une fois dans
 * chaque sens. Les sommets sont fusionnés à 1e-4 près.
 */
export function estFerme(m: Maillage): boolean {
  const p = m.positions;
  if (p.length === 0) return false;
  const sommets = new Map<string, number>();
  const idSommet = (i: number): number => {
    const cle = `${Math.round(p[i] * 1e4)},${Math.round(p[i + 1] * 1e4)},${Math.round(p[i + 2] * 1e4)}`;
    let id = sommets.get(cle);
    if (id === undefined) {
      id = sommets.size;
      sommets.set(cle, id);
    }
    return id;
  };
  // Pour chaque arête orientée a->b : +1. Fermé si a->b et b->a existent une fois chacune.
  const aretes = new Map<string, number>();
  for (let t = 0; t < p.length; t += 9) {
    const s = [idSommet(t), idSommet(t + 3), idSommet(t + 6)];
    for (let k = 0; k < 3; k++) {
      const a = s[k];
      const b = s[(k + 1) % 3];
      if (a === b) return false; // triangle dégénéré
      const cle = `${a}>${b}`;
      aretes.set(cle, (aretes.get(cle) ?? 0) + 1);
    }
  }
  for (const [cle, n] of aretes) {
    if (n !== 1) return false;
    const [a, b] = cle.split('>');
    if (aretes.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}
