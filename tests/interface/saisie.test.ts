import { describe, expect, it } from 'vitest';
import { lireNombre } from '../../src/interface/saisie';

describe('lireNombre', () => {
  it.each([
    ['0,4', 0.4],
    ['12.5', 12.5],
    [' 30 ', 30],
    ['0', 0],
    ['-1', -1],
    ['007', 7],
  ])('lit %j comme %d', (texte, attendu) => {
    expect(lireNombre(texte)).toBe(attendu);
  });

  it.each(['', '   ', 'abc', '1,2,3', '1.2.3', '12abc', '1e3', 'Infinity', 'NaN', ',', '.'])(
    'refuse %j',
    (texte) => {
      expect(lireNombre(texte)).toBeNull();
    },
  );
});
