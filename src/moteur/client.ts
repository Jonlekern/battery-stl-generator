import type { Piece } from '../types';
import { ErreurAnnulee, ErreurChargement, ErreurOpenScad } from './erreurs';
import type { DemandeRendu, ReponseRendu } from './worker';

export { ErreurAnnulee, ErreurChargement, ErreurOpenScad };

export interface Moteur {
  /** Rend un .scad en STL binaire, dans un Web Worker. */
  rendre(scad: string, piece: Piece): Promise<Uint8Array>;
  /** Abandonne les rendus en cours : ils rejettent avec ErreurAnnulee. */
  annuler(): void;
}

interface Attente {
  resolve: (stl: Uint8Array) => void;
  reject: (e: Error) => void;
}

export function creerMoteur(): Moteur {
  let worker: Worker | undefined;
  let prochainId = 1;
  const enAttente = new Map<number, Attente>();

  function toutRejeter(erreur: () => Error): void {
    const attentes = [...enAttente.values()];
    enAttente.clear();
    for (const a of attentes) a.reject(erreur());
  }

  function arreterWorker(): void {
    worker?.terminate();
    worker = undefined;
  }

  function obtenirWorker(): Worker {
    if (worker) return worker;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<ReponseRendu>) => {
      const r = e.data;
      const attente = enAttente.get(r.id);
      if (!attente) return;
      enAttente.delete(r.id);
      if (r.ok) attente.resolve(new Uint8Array(r.stl));
      else attente.reject(new ErreurOpenScad(r.message, r.journal));
    };
    // Le script du Worker ou le WASM n'a pas pu se charger.
    w.onerror = (e) => {
      e.preventDefault();
      arreterWorker();
      toutRejeter(() => new ErreurChargement(e.message || 'Le moteur 3D ne répond pas'));
    };
    worker = w;
    return w;
  }

  return {
    rendre(scad, piece) {
      return new Promise<Uint8Array>((resolve, reject) => {
        let w: Worker;
        try {
          w = obtenirWorker();
        } catch (e) {
          reject(new ErreurChargement(e instanceof Error ? e.message : String(e)));
          return;
        }
        const id = prochainId++;
        enAttente.set(id, { resolve, reject });
        const demande: DemandeRendu = { id, scad, piece };
        w.postMessage(demande);
      });
    },
    annuler() {
      if (enAttente.size === 0) return;
      // Un rendu OpenSCAD ne s'interrompt pas : on arrête le Worker.
      arreterWorker();
      toutRejeter(() => new ErreurAnnulee());
    },
  };
}
