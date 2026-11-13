import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creerCalcul3d, type Resultat3d } from '../../src/interface/calcul3d';
import { MESSAGE_CALCUL_ECHOUE, MESSAGE_MOTEUR_ABSENT } from '../../src/interface/messages';
import type { Moteur } from '../../src/moteur/client';
import { ErreurAnnulee, ErreurChargement } from '../../src/moteur/erreurs';
import type { Piece } from '../../src/types';

interface Appel {
  scad: string;
  piece: Piece;
  resoudre: (stl: Uint8Array) => void;
  rejeter: (e: Error) => void;
}

/** Faux moteur : chaque rendu reste en attente jusqu'à ce que le test le termine. */
function fauxMoteur() {
  const appels: Appel[] = [];
  let annulations = 0;
  const moteur: Moteur = {
    rendre: (scad, piece) =>
      new Promise<Uint8Array>((resoudre, rejeter) => {
        appels.push({ scad, piece, resoudre, rejeter });
      }),
    annuler: () => {
      annulations++;
    },
  };
  return { moteur, appels, annulations: () => annulations };
}

const stl = (marque: number) => new Uint8Array([marque]);
/** Laisse les promesses en attente se dérouler. */
const laisserPasser = () => vi.advanceTimersByTimeAsync(0);

describe('creerCalcul3d', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('attend 500 ms après le dernier changement et ne lance qu\'un rendu', async () => {
    const { moteur, appels } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    const calcul = creerCalcul3d(moteur, (r) => resultats.push(r));

    calcul.demander('A', false);
    await vi.advanceTimersByTimeAsync(50);
    calcul.demander('B', false);
    await vi.advanceTimersByTimeAsync(50);
    calcul.demander('C', false);
    await vi.advanceTimersByTimeAsync(499);
    expect(appels).toHaveLength(0);
    expect(resultats).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(appels.map((a) => `${a.scad}:${a.piece}`)).toEqual(['C:corps']);
    expect(resultats).toEqual([{ etat: 'calcul' }]);
  });

  it('rend le corps puis les étiquettes, et livre les deux ensemble', async () => {
    const { moteur, appels } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    creerCalcul3d(moteur, (r) => resultats.push(r)).demander('A', true);
    await vi.advanceTimersByTimeAsync(500);

    appels[0].resoudre(stl(1));
    await laisserPasser();
    expect(appels.map((a) => a.piece)).toEqual(['corps', 'etiquettes']);
    expect(resultats).toEqual([{ etat: 'calcul' }]);

    appels[1].resoudre(stl(2));
    await laisserPasser();
    expect(resultats[1]).toEqual({ etat: 'pret', corps: stl(1), etiquettes: stl(2) });
  });

  it('ne demande jamais la pièce « etiquettes » quand il n\'y en a pas', async () => {
    const { moteur, appels } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    creerCalcul3d(moteur, (r) => resultats.push(r)).demander('A', false);
    await vi.advanceTimersByTimeAsync(500);
    appels[0].resoudre(stl(1));
    await laisserPasser();

    expect(appels.map((a) => a.piece)).toEqual(['corps']);
    expect(resultats[1]).toEqual({ etat: 'pret', corps: stl(1), etiquettes: null });
  });

  it('jette le résultat d\'un calcul remplacé, même s\'il arrive en retard', async () => {
    const { moteur, appels, annulations } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    const calcul = creerCalcul3d(moteur, (r) => resultats.push(r));

    calcul.demander('A', false);
    await vi.advanceTimersByTimeAsync(500); // le rendu de A est en cours
    calcul.demander('B', false);
    await vi.advanceTimersByTimeAsync(500); // le rendu de B démarre
    expect(annulations()).toBe(2); // un nettoyage avant chaque rendu
    expect(appels.map((a) => a.scad)).toEqual(['A', 'B']);

    appels[0].resoudre(stl(1)); // A finit après le lancement de B
    await laisserPasser();
    appels[1].resoudre(stl(2));
    await laisserPasser();

    expect(resultats).toEqual([
      { etat: 'calcul' },
      { etat: 'calcul' },
      { etat: 'pret', corps: stl(2), etiquettes: null },
    ]);
  });

  it('ignore l\'annulation d\'un rendu remplacé', async () => {
    const { moteur, appels } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    const calcul = creerCalcul3d(moteur, (r) => resultats.push(r));
    calcul.demander('A', false);
    await vi.advanceTimersByTimeAsync(500);
    calcul.demander('B', false);
    await vi.advanceTimersByTimeAsync(500);

    appels[0].rejeter(new ErreurAnnulee());
    await laisserPasser();
    expect(resultats).toEqual([{ etat: 'calcul' }, { etat: 'calcul' }]);
  });

  it('signale un calcul qui échoue', async () => {
    const { moteur, appels } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    creerCalcul3d(moteur, (r) => resultats.push(r)).demander('A', false);
    await vi.advanceTimersByTimeAsync(500);
    appels[0].rejeter(new Error('boum'));
    await laisserPasser();
    expect(resultats[1]).toEqual({ etat: 'erreur', message: MESSAGE_CALCUL_ECHOUE });
  });

  it('distingue un moteur qui n\'a pas pu se charger', async () => {
    const { moteur, appels } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    creerCalcul3d(moteur, (r) => resultats.push(r)).demander('A', false);
    await vi.advanceTimersByTimeAsync(500);
    appels[0].rejeter(new ErreurChargement('pas de worker'));
    await laisserPasser();
    expect(resultats[1]).toEqual({ etat: 'erreur', message: MESSAGE_MOTEUR_ABSENT });
  });

  it('ne livre plus rien après arreter()', async () => {
    const { moteur, appels } = fauxMoteur();
    const resultats: Resultat3d[] = [];
    const calcul = creerCalcul3d(moteur, (r) => resultats.push(r));
    calcul.demander('A', false);
    await vi.advanceTimersByTimeAsync(500);
    calcul.arreter();
    appels[0].resoudre(stl(1));
    await laisserPasser();
    calcul.demander('B', false);
    calcul.arreter();
    await vi.advanceTimersByTimeAsync(1000);

    expect(resultats).toEqual([{ etat: 'calcul' }]);
    expect(appels).toHaveLength(1);
  });
});
