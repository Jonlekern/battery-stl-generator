type Point = [number, number, number];

/** Fabrique un STL binaire à partir de triangles (3 points chacun). */
export function fabriquerStl(triangles: [Point, Point, Point][]): Uint8Array {
  const octets = new Uint8Array(84 + triangles.length * 50);
  const vue = new DataView(octets.buffer);
  vue.setUint32(80, triangles.length, true);
  triangles.forEach((t, i) => {
    const debut = 84 + i * 50 + 12; // on saute la normale
    t.flat().forEach((v, k) => vue.setFloat32(debut + k * 4, v, true));
  });
  return octets;
}

/** Tétraèdre fermé de volume 1/6, faces orientées vers l'extérieur. */
export const TETRAEDRE: [Point, Point, Point][] = [
  [[0, 0, 0], [0, 1, 0], [1, 0, 0]],
  [[0, 0, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
];
