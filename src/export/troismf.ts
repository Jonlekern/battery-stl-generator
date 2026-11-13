import { strToU8, zipSync } from 'fflate';
import type { Maillage } from './stl';

const TYPES_DE_CONTENU = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;

const RELATIONS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

function attribut(texte: string): string {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Coordonnée écrite au dix-millième de millimètre, sans zéros inutiles. */
function coordonnee(v: number): string {
  const arrondie = Math.round(v * 1e4) / 1e4;
  return String(Object.is(arrondie, -0) ? 0 : arrondie);
}

/** Un <object> avec son maillage : sommets dédupliqués, triangles indexés. */
function objetMaillage(id: number, nom: string, m: Maillage): string {
  const p = m.positions;
  const indexParSommet = new Map<string, number>();
  const sommets: string[] = [];
  const triangles: string[] = [];

  for (let t = 0; t < p.length; t += 9) {
    const indices: number[] = [];
    for (let s = 0; s < 3; s++) {
      const x = coordonnee(p[t + s * 3]);
      const y = coordonnee(p[t + s * 3 + 1]);
      const z = coordonnee(p[t + s * 3 + 2]);
      const cle = `${x} ${y} ${z}`;
      let index = indexParSommet.get(cle);
      if (index === undefined) {
        index = sommets.length;
        indexParSommet.set(cle, index);
        sommets.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
      }
      indices.push(index);
    }
    triangles.push(`<triangle v1="${indices[0]}" v2="${indices[1]}" v3="${indices[2]}"/>`);
  }

  return [
    `<object id="${id}" type="model" name="${attribut(nom)}">`,
    '<mesh>',
    '<vertices>',
    sommets.join('\n'),
    '</vertices>',
    '<triangles>',
    triangles.join('\n'),
    '</triangles>',
    '</mesh>',
    '</object>',
  ].join('\n');
}

/**
 * Fabrique un fichier 3MF. Avec plusieurs pièces, elles sont regroupées dans
 * un seul objet : le slicer les garde alignées et permet de donner une couleur
 * à chacune.
 */
export function creer3mf(pieces: { nom: string; maillage: Maillage }[]): Uint8Array {
  if (pieces.length === 0) throw new Error('3MF : aucune pièce à écrire');
  for (const piece of pieces) {
    if (piece.maillage.positions.length === 0) {
      throw new Error(`3MF : la pièce « ${piece.nom} » est vide`);
    }
  }

  const objets = pieces.map((piece, i) => objetMaillage(i + 1, piece.nom, piece.maillage));
  let idPlace = 1;
  if (pieces.length > 1) {
    idPlace = pieces.length + 1;
    objets.push(
      [
        `<object id="${idPlace}" type="model" name="insert-piles">`,
        '<components>',
        ...pieces.map((_, i) => `<component objectid="${i + 1}"/>`),
        '</components>',
        '</object>',
      ].join('\n'),
    );
  }

  const modele = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="fr" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    '<resources>',
    ...objets,
    '</resources>',
    '<build>',
    `<item objectid="${idPlace}"/>`,
    '</build>',
    '</model>',
    '',
  ].join('\n');

  return zipSync({
    '[Content_Types].xml': strToU8(TYPES_DE_CONTENU),
    '_rels/.rels': strToU8(RELATIONS),
    '3D/3dmodel.model': strToU8(modele),
  });
}
