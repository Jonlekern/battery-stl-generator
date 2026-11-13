import { describe, expect, it } from 'vitest';
import { CLE_STOCKAGE, DEMANDE_DEFAUT, chargerDemande, sauverDemande } from '../../src/interface/etat';
import { IMPRIMANTES } from '../../src/interface/imprimantes';
import { calculerPlan } from '../../src/placement';
import { OPTIONS_DEFAUT, type Demande } from '../../src/types';

function fauxStockage(contenu?: string): Storage {
  const donnees = new Map<string, string>();
  if (contenu !== undefined) donnees.set(CLE_STOCKAGE, contenu);
  return {
    getItem: (cle) => donnees.get(cle) ?? null,
    setItem: (cle, valeur) => void donnees.set(cle, valeur),
    removeItem: (cle) => void donnees.delete(cle),
    clear: () => donnees.clear(),
    key: () => null,
    get length() {
      return donnees.size;
    },
  };
}

const valide: Demande = {
  tiroir: { largeur: 250, profondeur: 350, hauteur: 60 },
  plateau: { largeur: 220, profondeur: 220 },
  quantites: { aa: 4, d: 2 },
  reste: { mode: 'plus', pileId: 'aaa' },
  options: { ...OPTIONS_DEFAUT, jeu: 0.6, etiquettes: 'grave' },
};

describe('DEMANDE_DEFAUT', () => {
  it('est celle de la spec et donne un plan valide', () => {
    expect(DEMANDE_DEFAUT).toEqual({
      tiroir: { largeur: 300, profondeur: 400 },
      plateau: { largeur: 256, profondeur: 256 },
      quantites: { aa: 8, aaa: 8, '9v': 2, cr2032: 6 },
      reste: { mode: 'rien' },
      options: OPTIONS_DEFAUT,
    });
    expect(calculerPlan(DEMANDE_DEFAUT).ok).toBe(true);
  });
});

describe('IMPRIMANTES', () => {
  it('propose les cinq préréglages de la spec', () => {
    expect(IMPRIMANTES.map((i) => `${i.nom} ${i.largeur}x${i.profondeur}`)).toEqual([
      'Bambu A1 mini 180x180',
      'Bambu A1 / P1 / X1 256x256',
      'Prusa MK4 250x210',
      'Prusa Mini 180x180',
      'Ender 3 220x220',
    ]);
  });
});

describe('chargerDemande', () => {
  it.each([
    ['clé absente', undefined],
    ['JSON corrompu', '{"tiroir": '],
    ['valeur qui n\'est pas un objet', '42'],
    ['null', 'null'],
    ['objet sans tiroir', JSON.stringify({ ...valide, tiroir: undefined })],
    ['options absentes', JSON.stringify({ ...valide, options: undefined })],
    ['quantités mal formées', JSON.stringify({ ...valide, quantites: [1, 2] })],
    ['mode de reste inconnu', JSON.stringify({ ...valide, reste: { mode: 'xyz' } })],
    ['tiroir hors limites', JSON.stringify({ ...valide, tiroir: { largeur: 5, profondeur: 350 } })],
    ['quantité non numérique', JSON.stringify({ ...valide, quantites: { aa: 'beaucoup' } })],
  ])('revient aux réglages par défaut : %s', (_, contenu) => {
    expect(chargerDemande(fauxStockage(contenu))).toEqual(DEMANDE_DEFAUT);
  });

  it('retire les piles inconnues et garde le reste', () => {
    const ancienne = { ...valide, quantites: { aa: 4, xyz: 3, d: 2 } };
    expect(chargerDemande(fauxStockage(JSON.stringify(ancienne)))).toEqual(valide);
  });

  it('relit à l\'identique ce que sauverDemande a écrit', () => {
    const stockage = fauxStockage();
    sauverDemande(valide, stockage);
    expect(chargerDemande(stockage)).toEqual(valide);
  });

  it('garde une demande qui ne rentre pas : c\'est un réglage, pas une donnée corrompue', () => {
    const tropPlein = { ...valide, tiroir: { largeur: 30, profondeur: 30 } };
    expect(chargerDemande(fauxStockage(JSON.stringify(tropPlein)))).toEqual(tropPlein);
  });

  it('rend une copie : modifier le résultat ne change pas les réglages par défaut', () => {
    const d = chargerDemande(fauxStockage());
    d.quantites.aa = 99;
    d.tiroir.largeur = 123;
    expect(DEMANDE_DEFAUT.quantites.aa).toBe(8);
    expect(DEMANDE_DEFAUT.tiroir.largeur).toBe(300);
  });

  it('survit à un stockage qui refuse tout accès', () => {
    const bloque = {
      getItem: () => {
        throw new Error('accès refusé');
      },
      setItem: () => {
        throw new Error('accès refusé');
      },
    } as unknown as Storage;
    expect(chargerDemande(bloque)).toEqual(DEMANDE_DEFAUT);
    expect(() => sauverDemande(valide, bloque)).not.toThrow();
  });
});
