import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { estFerme, lireStl, volume } from '../../src/export/stl';
import { creer3mf } from '../../src/export/troismf';
import { cube, fabriquerStl } from '../aide/stl';

const corps = lireStl(fabriquerStl(cube(10)));
const etiquettes = lireStl(fabriquerStl(cube(2, [4, 4, 10])));
const compter = (texte: string, motif: string) => texte.split(motif).length - 1;

function modele(octets: Uint8Array): string {
  return strFromU8(unzipSync(octets)['3D/3dmodel.model']);
}

describe('creer3mf', () => {
  it('part de cubes de test valides', () => {
    expect(estFerme(corps)).toBe(true);
    expect(volume(corps)).toBeCloseTo(1000);
  });

  it('produit une archive 3MF avec ses trois fichiers', () => {
    const octets = creer3mf([{ nom: 'corps', maillage: corps }]);
    expect(strFromU8(octets.slice(0, 2))).toBe('PK');
    const fichiers = unzipSync(octets);
    expect(Object.keys(fichiers).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
    expect(strFromU8(fichiers['_rels/.rels'])).toContain('Target="/3D/3dmodel.model"');
    expect(strFromU8(fichiers['[Content_Types].xml'])).toContain(
      'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    );
  });

  it('regroupe deux pièces dans un seul objet à placer', () => {
    const xml = modele(
      creer3mf([
        { nom: 'corps', maillage: corps },
        { nom: 'etiquettes', maillage: etiquettes },
      ]),
    );
    expect(xml).toContain('unit="millimeter"');
    expect(compter(xml, '<mesh>')).toBe(2);
    expect(compter(xml, '<vertex ')).toBe(16);
    expect(compter(xml, '<triangle ')).toBe(24);
    expect(compter(xml, '<components>')).toBe(1);
    expect(compter(xml, '<component ')).toBe(2);
    expect(compter(xml, '<item ')).toBe(1);
    expect(xml).toContain('name="corps"');
    expect(xml).toContain('name="etiquettes"');
    // L'objet placé sur le plateau est l'assemblage, pas une pièce seule.
    expect(xml).toMatch(/<object id="3"[^>]*>\s*<components>/);
    expect(xml).toContain('<item objectid="3"');
  });

  it('place directement la pièce quand il n\'y en a qu\'une', () => {
    const xml = modele(creer3mf([{ nom: 'corps', maillage: corps }]));
    expect(compter(xml, '<mesh>')).toBe(1);
    expect(compter(xml, '<components>')).toBe(0);
    expect(compter(xml, '<item ')).toBe(1);
    expect(xml).toContain('<item objectid="1"');
  });

  it('écrit des sommets dédupliqués et des triangles qui les référencent', () => {
    const xml = modele(creer3mf([{ nom: 'corps', maillage: corps }]));
    expect(xml).toContain('<vertex x="10" y="10" z="10"/>');
    const indices = [...xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)].flatMap((m) =>
      m.slice(1).map(Number),
    );
    expect(indices).toHaveLength(36);
    expect(Math.max(...indices)).toBe(7);
    expect(new Set(indices).size).toBe(8);
  });

  it('échappe le nom des pièces', () => {
    const xml = modele(creer3mf([{ nom: 'a"<b>&c', maillage: corps }]));
    expect(xml).toContain('name="a&quot;&lt;b&gt;&amp;c"');
  });

  it('refuse une liste vide ou une pièce sans triangle', () => {
    expect(() => creer3mf([])).toThrow();
    expect(() => creer3mf([{ nom: 'vide', maillage: { positions: new Float32Array(0) } }])).toThrow();
  });
});
