import { describe, expect, it } from 'vitest';
import { boiteEnglobante, estFerme, volume } from '../../src/export/stl';
import { OPTIONS_DEFAUT, type Demande, type PlanOk } from '../../src/types';
import { demande, planOk, rendreDemande, rendrePlan } from '../aide/rendu';
import { estDansLaMatiere } from '../aide/solide';

const DELAI = 120_000;

async function avecEtSans(quantites: Demande['quantites']) {
  const avec = demande({ quantites });
  const sans = demande({ quantites, options: { ...OPTIONS_DEFAUT, encoches: false } });
  const [mAvec, mSans] = await Promise.all([rendreDemande(avec, 'corps'), rendreDemande(sans, 'corps')]);
  return { avec, mAvec, mSans };
}

describe('encoches pour les doigts', () => {
  it('dégage les bords des piles bouton', async () => {
    const { mAvec, mSans } = await avecEtSans({ cr2032: 6 });
    expect(estFerme(mAvec)).toBe(true);
    // Au moins 5 % de matière en moins : les encoches sont de vraies découpes.
    expect(volume(mAvec)).toBeLessThan(volume(mSans) * 0.95);
    expect(boiteEnglobante(mAvec)).toEqual(boiteEnglobante(mSans));
  }, DELAI);

  it('entaille les petits côtés des poches rectangulaires', async () => {
    const { mAvec, mSans } = await avecEtSans({ '9v': 2 });
    expect(estFerme(mAvec)).toBe(true);
    expect(volume(mAvec)).toBeLessThan(volume(mSans) - 50);
    expect(boiteEnglobante(mAvec)).toEqual(boiteEnglobante(mSans));
  }, DELAI);

  it('ne touche pas aux piles cylindriques', async () => {
    const { mAvec, mSans } = await avecEtSans({ aa: 12 });
    expect(Math.abs(volume(mAvec) - volume(mSans)) / volume(mSans)).toBeLessThan(1e-4);
  }, DELAI);

  it('reste dans l\'emprise de la zone quand deux zones se touchent', async () => {
    const { avec, mAvec } = await avecEtSans({ '9v': 2, aa: 8 });
    const plan = planOk(avec);
    expect(estFerme(mAvec)).toBe(true);
    const b = boiteEnglobante(mAvec);
    expect(b.max[0]).toBeCloseTo(plan.insert.largeur, 2);
    expect(b.max[1]).toBeCloseTo(plan.insert.profondeur, 2);
    expect(b.max[2]).toBeCloseTo(plan.insert.hauteur, 2);
  }, DELAI);

  it('abaisse le bloc aux deux bouts des fentes de piles bouton, pas au milieu', async () => {
    const { avec, mAvec, mSans } = await avecEtSans({ cr2032: 6 });
    const z = planOk(avec).zones[0];
    // 6 fentes côte à côte, tournées : l'épaisseur en X, le diamètre en Y.
    expect(z).toMatchObject({ colonnes: 6, rangees: 1, tournee: true });
    // Dans la paroi entre la 1re et la 2e pile : x = 0,6 + 4,8.
    const x = z.x + 0.6 + 4.8;
    const yCentre = z.y + 8 + 0.6 + 10.8;
    const auBout: [number, number, number] = [x, yCentre + 8, 9]; // au-dessus de 2 + 30 % × 20 = 8
    const auMilieu: [number, number, number] = [x, yCentre, 12];
    const sousLEncoche: [number, number, number] = [x, yCentre + 8, 7];
    expect(estDansLaMatiere(mSans, auBout)).toBe(true);
    expect(estDansLaMatiere(mAvec, auBout)).toBe(false);
    expect(estDansLaMatiere(mAvec, auMilieu)).toBe(true);
    expect(estDansLaMatiere(mAvec, sousLEncoche)).toBe(true);
  }, DELAI);

  it('entaille la paroi arrière d\'une poche 9V sur sa moitié haute seulement', async () => {
    const { avec, mAvec, mSans } = await avecEtSans({ '9v': 2 });
    const z = planOk(avec).zones[0];
    expect(z).toMatchObject({ colonnes: 2, rangees: 1, tournee: true });
    // Paroi extérieure derrière la 1re poche : 0,6 mm après le bord de la poche.
    const x = z.x + 0.6 + 9.55;
    const y = z.y + 8 + 0.6 + 14.05 + 13.45 + 0.6;
    expect(estDansLaMatiere(mSans, [x, y, 20])).toBe(true);
    expect(estDansLaMatiere(mAvec, [x, y, 20])).toBe(false); // moitié haute : entaillée
    expect(estDansLaMatiere(mAvec, [x, y, 6])).toBe(true); // moitié basse : intacte
  }, DELAI);

  it('ne mord pas sur la bande d\'étiquette', async () => {
    const { avec, mAvec } = await avecEtSans({ '9v': 2 });
    const z = planOk(avec).zones[0];
    // Au milieu de la bande, devant chaque poche, juste sous la surface.
    for (const colonne of [0, 1]) {
      const x = z.x + 0.6 + (colonne + 0.5) * 19.1;
      expect(estDansLaMatiere(mAvec, [x, z.y + 4, z.hauteur - 0.5]), `colonne ${colonne}`).toBe(true);
      expect(estDansLaMatiere(mAvec, [x, z.y + 7.5, z.hauteur - 0.5]), `colonne ${colonne}`).toBe(true);
    }
  }, DELAI);

  it('ne mord pas sur la zone voisine', async () => {
    // Une poche 9V dont l'encoche de droite déborderait de 5,8 mm sur la zone AA voisine.
    const d = demande({ quantites: { '9v': 1, aa: 4 }, options: { ...OPTIONS_DEFAUT, etiquettes: 'aucune' } });
    const plan: PlanOk = {
      ok: true,
      insert: { largeur: 62.7, profondeur: 33.4, hauteur: 22.2 },
      zones: [
        { genre: 'piles', pileId: '9v', x: 0, y: 0, largeur: 29.3, profondeur: 20.3, hauteur: 21.4, colonnes: 1, rangees: 1, tournee: false },
        { genre: 'piles', pileId: 'aa', x: 29.3, y: 0, largeur: 33.4, profondeur: 33.4, hauteur: 22.2, colonnes: 2, rangees: 2, tournee: false },
      ],
      avertissements: [],
    };
    const m = await rendrePlan(plan, d, 'corps');
    expect(estFerme(m)).toBe(true);
    // Dans la paroi extérieure de la zone AA, à 0,3 mm de la frontière, face à l'encoche.
    expect(estDansLaMatiere(m, [29.6, 10.15, 20.4])).toBe(true);
    // L'encoche existe bien côté 9V : la paroi de la zone 9V est entaillée.
    expect(estDansLaMatiere(m, [28.7, 10.15, 20.4])).toBe(false);
  }, DELAI);
});
