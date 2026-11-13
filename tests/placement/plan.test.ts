import { describe, expect, it } from 'vitest';
import { PILES } from '../../src/catalogue';
import { calculerPlan, nombreAlveoles } from '../../src/placement';
import { OPTIONS_DEFAUT, type Demande, type Erreur, type PlanOk } from '../../src/types';
import { verifierInvariants } from '../aide/invariants';

function demande(surcharge: Partial<Demande> = {}): Demande {
  return {
    tiroir: { largeur: 300, profondeur: 400 },
    plateau: { largeur: 256, profondeur: 256 },
    quantites: {},
    reste: { mode: 'rien' },
    options: OPTIONS_DEFAUT,
    ...surcharge,
  };
}

function planOk(d: Demande): PlanOk {
  const plan = calculerPlan(d);
  if (!plan.ok) throw new Error(`plan refusé : ${JSON.stringify(plan.erreurs)}`);
  return plan;
}

function erreurs(d: Demande): Erreur[] {
  const plan = calculerPlan(d);
  if (plan.ok) throw new Error('le plan aurait dû être refusé');
  return plan.erreurs;
}

const MIXTE = { aa: 8, aaa: 8, '9v': 2, cr2032: 6 };

describe('calculerPlan : mode « rien »', () => {
  it('fait un insert compact pour 12 AA', () => {
    const plan = planOk(demande({ quantites: { aa: 12 } }));
    expect(plan.zones).toHaveLength(1);
    const z = plan.zones[0];
    expect(z).toMatchObject({ genre: 'piles', pileId: 'aa', x: 0, y: 0, colonnes: 4, rangees: 3, tournee: false });
    expect(z.etiquette).toEqual({ texte: 'AA', hauteurTexte: 6 });
    expect(plan.insert.largeur).toBeCloseTo(65.6);
    expect(plan.insert.profondeur).toBeCloseTo(57.5);
    expect(plan.insert.hauteur).toBeCloseTo(22.2);
    expect(plan.avertissements).toEqual([]);
  });

  it('range plusieurs types en respectant les invariants', () => {
    const d = demande({ quantites: MIXTE });
    const plan = planOk(d);
    expect(plan.zones).toHaveLength(4);
    verifierInvariants(plan, d);
  });

  it('ne met pas d\'étiquette quand elles sont désactivées', () => {
    const plan = planOk(demande({ quantites: { aa: 12 }, options: { ...OPTIONS_DEFAUT, etiquettes: 'aucune' } }));
    expect(plan.zones[0].etiquette).toBeUndefined();
    expect(plan.insert.profondeur).toBeCloseTo(49.5);
    expect(plan.avertissements).toEqual([]);
  });

  it('préfère une forme assez large pour porter son étiquette', () => {
    // 6 CR2032 tiendraient dans une bande de 10,8 mm de large, sans place pour « CR2032 ».
    const plan = planOk(demande({ quantites: MIXTE }));
    expect(plan.avertissements).toEqual([]);
    for (const z of plan.zones) expect(z.etiquette, z.pileId).toBeDefined();
  });

  it('garde une forme sans étiquette quand aucune n\'est assez large', () => {
    const plan = planOk(demande({ quantites: { cr2032: 1 } }));
    expect(plan.zones).toHaveLength(1);
    expect(plan.zones[0].etiquette).toBeUndefined();
  });

  it('rend le même plan pour la même demande', () => {
    expect(calculerPlan(demande({ quantites: MIXTE }))).toEqual(calculerPlan(demande({ quantites: MIXTE })));
  });
});

describe('calculerPlan : mode « usagees »', () => {
  it('remplit le tiroir avec un bac pour les piles usagées', () => {
    const d = demande({ quantites: { aa: 12 }, reste: { mode: 'usagees' } });
    const plan = planOk(d);
    expect(plan.insert.largeur).toBeCloseTo(299);
    expect(plan.insert.profondeur).toBeCloseTo(399);
    const bacs = plan.zones.filter((z) => z.genre === 'usagees');
    expect(bacs).toHaveLength(1);
    expect(bacs[0].largeur).toBeGreaterThanOrEqual(40);
    expect(bacs[0].profondeur).toBeGreaterThanOrEqual(40);
    expect(bacs[0].hauteur).toBeCloseTo(22.2);
    expect(bacs[0].etiquette).toEqual({ texte: 'USAGÉES', hauteurTexte: 6 });
    expect(plan.avertissements).toEqual([{ code: 'plateau' }]);
    verifierInvariants(plan, d);
  });

  it('prévient quand il n\'y a pas la place pour le bac', () => {
    const plan = planOk(demande({ tiroir: { largeur: 70, profondeur: 60 }, quantites: { aa: 12 }, reste: { mode: 'usagees' } }));
    expect(plan.zones.some((z) => z.genre === 'usagees')).toBe(false);
    expect(plan.avertissements).toContainEqual({ code: 'usagees_impossible' });
  });

  it('respecte les invariants avec plusieurs types', () => {
    const d = demande({ quantites: MIXTE, reste: { mode: 'usagees' } });
    verifierInvariants(planOk(d), d);
  });
});

describe('calculerPlan : mode « plus »', () => {
  it('remplit un tiroir vide avec le type choisi', () => {
    const d = demande({ tiroir: { largeur: 100, profondeur: 100 }, reste: { mode: 'plus', pileId: 'aa' } });
    const plan = planOk(d);
    expect(plan.insert.largeur).toBeCloseTo(99);
    expect(plan.insert.profondeur).toBeCloseTo(99);
    expect(plan.zones).toHaveLength(1);
    expect(plan.zones[0]).toMatchObject({ genre: 'piles', pileId: 'aa', colonnes: 6, rangees: 5 });
    expect(nombreAlveoles(plan.zones[0])).toBe(30);
    verifierInvariants(plan, d);
  });

  it('ajoute des piles dans l\'espace libre autour des zones demandées', () => {
    const d = demande({ quantites: MIXTE, reste: { mode: 'plus', pileId: 'aaa' } });
    const plan = planOk(d);
    const aaa = plan.zones.filter((z) => z.pileId === 'aaa').reduce((n, z) => n + nombreAlveoles(z), 0);
    expect(aaa).toBeGreaterThan(8);
    expect(plan.insert.largeur).toBeCloseTo(299);
    verifierInvariants(plan, d);
  });
});

describe('calculerPlan : avertissements', () => {
  it('prévient quand une pile debout dépasse la hauteur du tiroir', () => {
    const plan = planOk(demande({ tiroir: { largeur: 300, profondeur: 400, hauteur: 50 }, quantites: { aa: 1 } }));
    expect(plan.avertissements).toContainEqual({ code: 'hauteur', pileId: 'aa', hauteurTotale: 52.5 });
  });

  it('ne prévient pas quand la hauteur du tiroir suffit ou n\'est pas donnée', () => {
    const haut = planOk(demande({ tiroir: { largeur: 300, profondeur: 400, hauteur: 60 }, quantites: { aa: 1 } }));
    expect(haut.avertissements.some((a) => a.code === 'hauteur')).toBe(false);
    const sans = planOk(demande({ quantites: { aa: 1 } }));
    expect(sans.avertissements.some((a) => a.code === 'hauteur')).toBe(false);
  });

  it('omet l\'étiquette d\'une zone trop étroite et le signale', () => {
    const plan = planOk(demande({ quantites: { cr2032: 1 } }));
    expect(plan.zones[0].etiquette).toBeUndefined();
    expect(plan.avertissements).toEqual([{ code: 'etiquette_omise', pileId: 'cr2032' }]);
  });

  it('accepte un insert qui tient sur le plateau une fois tourné', () => {
    const plan = planOk(demande({ plateau: { largeur: 60, profondeur: 70 }, quantites: { aa: 12 } }));
    expect(plan.avertissements.some((a) => a.code === 'plateau')).toBe(false);
  });

  it('prévient quand l\'insert ne tient sur le plateau dans aucun sens', () => {
    const plan = planOk(demande({ plateau: { largeur: 60, profondeur: 60 }, quantites: { aa: 12 } }));
    expect(plan.avertissements).toContainEqual({ code: 'plateau' });
  });
});

describe('calculerPlan : erreurs', () => {
  it('refuse une pile qui ne rentre pas, en la nommant', () => {
    expect(calculerPlan(demande({ tiroir: { largeur: 30, profondeur: 30 }, quantites: { d: 1 } }))).toEqual({
      ok: false,
      erreurs: [{ code: 'ne_rentre_pas', pileIds: ['d'] }],
    });
  });

  it('refuse une demande sans aucune pile', () => {
    expect(erreurs(demande())).toEqual([{ code: 'aucune_pile' }]);
    expect(erreurs(demande({ quantites: { aa: 0 } }))).toEqual([{ code: 'aucune_pile' }]);
  });

  it.each([
    ['tiroir.largeur', demande({ tiroir: { largeur: 29, profondeur: 400 }, quantites: { aa: 1 } })],
    ['tiroir.largeur', demande({ tiroir: { largeur: NaN, profondeur: 400 }, quantites: { aa: 1 } })],
    ['tiroir.profondeur', demande({ tiroir: { largeur: 300, profondeur: 1001 }, quantites: { aa: 1 } })],
    ['tiroir.hauteur', demande({ tiroir: { largeur: 300, profondeur: 400, hauteur: 9 }, quantites: { aa: 1 } })],
    ['plateau.largeur', demande({ plateau: { largeur: 49, profondeur: 256 }, quantites: { aa: 1 } })],
    ['quantites.aa', demande({ quantites: { aa: 501 } })],
    ['quantites.aa', demande({ quantites: { aa: 1.5 } })],
    ['quantites.aa', demande({ quantites: { aa: -1 } })],
    ['quantites.aa', demande({ quantites: { aa: NaN } })],
    ['quantites.xyz', demande({ quantites: { xyz: 3 } })],
    ['reste.pileId', demande({ quantites: { aa: 1 }, reste: { mode: 'plus', pileId: 'xyz' } })],
    ['options.jeu', demande({ quantites: { aa: 1 }, options: { ...OPTIONS_DEFAUT, jeu: 2.1 } })],
    ['options.fond', demande({ quantites: { aa: 1 }, options: { ...OPTIONS_DEFAUT, fond: 0.5 } })],
    ['options.paroi', demande({ quantites: { aa: 1 }, options: { ...OPTIONS_DEFAUT, paroi: Infinity } })],
    ['options.profondeurPct', demande({ quantites: { aa: 1 }, options: { ...OPTIONS_DEFAUT, profondeurPct: 19 } })],
  ])('refuse une saisie hors limites : %s', (champ, d) => {
    expect(erreurs(d)).toEqual([{ code: 'saisie', champ }]);
  });

  it('rend toutes les erreurs de saisie ensemble', () => {
    const e = erreurs(demande({ tiroir: { largeur: 5, profondeur: 5 }, quantites: { aa: -1 } }));
    expect(e.map((x) => (x.code === 'saisie' ? x.champ : x.code))).toEqual([
      'tiroir.largeur',
      'tiroir.profondeur',
      'quantites.aa',
    ]);
  });

  it('tolère une quantité nulle sur une pile inconnue', () => {
    expect(calculerPlan(demande({ quantites: { aa: 1, xyz: 0 } })).ok).toBe(true);
  });
});

describe('calculerPlan : robustesse', () => {
  it('répond vite même avec 500 piles de chaque type', () => {
    const quantites = Object.fromEntries(PILES.map((p) => [p.id, 500]));
    const debut = performance.now();
    const plan = calculerPlan(demande({ tiroir: { largeur: 1000, profondeur: 1000 }, quantites }));
    expect(performance.now() - debut).toBeLessThan(1000);
    expect(plan.ok).toBe(false);
  });

  it('respecte les invariants pour chaque pile du catalogue, seule', () => {
    for (const p of PILES) {
      const d = demande({ quantites: { [p.id]: 5 } });
      verifierInvariants(planOk(d), d);
    }
  });
});
