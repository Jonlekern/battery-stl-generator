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

/** Les 12 triangles d'un cube de côté `c` dont un coin est en `origine`. */
export function cube(c: number, origine: Point = [0, 0, 0]): [Point, Point, Point][] {
  const [x, y, z] = origine;
  const s = (i: number, j: number, k: number): Point => [x + i * c, y + j * c, z + k * c];
  const faces: [Point, Point, Point, Point][] = [
    [s(0, 0, 0), s(0, 1, 0), s(1, 1, 0), s(1, 0, 0)], // dessous
    [s(0, 0, 1), s(1, 0, 1), s(1, 1, 1), s(0, 1, 1)], // dessus
    [s(0, 0, 0), s(1, 0, 0), s(1, 0, 1), s(0, 0, 1)], // avant
    [s(0, 1, 0), s(0, 1, 1), s(1, 1, 1), s(1, 1, 0)], // arrière
    [s(0, 0, 0), s(0, 0, 1), s(0, 1, 1), s(0, 1, 0)], // gauche
    [s(1, 0, 0), s(1, 1, 0), s(1, 1, 1), s(1, 0, 1)], // droite
  ];
  return faces.flatMap(([a, b, c2, d]) => [
    [a, b, c2],
    [a, c2, d],
  ] as [Point, Point, Point][]);
}
