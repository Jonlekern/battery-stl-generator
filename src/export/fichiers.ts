import type { PlanOk } from '../types';

export type Extension = 'stl' | '3mf' | 'scad';

export const TYPES_MIME: Record<Extension, string> = {
  stl: 'model/stl',
  '3mf': 'model/3mf',
  scad: 'text/plain;charset=utf-8',
};

/** Nom du fichier téléchargé : dimensions de l'insert, arrondies au millimètre. */
export function nomFichier(plan: PlanOk, extension: Extension): string {
  const largeur = Math.round(plan.insert.largeur);
  const profondeur = Math.round(plan.insert.profondeur);
  return `insert-piles-${largeur}x${profondeur}.${extension}`;
}

/** Propose le fichier au téléchargement dans le navigateur. */
export function telecharger(contenu: Uint8Array | string, nom: string, mime: string): void {
  const partie: BlobPart = typeof contenu === 'string' ? contenu : (contenu as Uint8Array<ArrayBuffer>);
  const url = URL.createObjectURL(new Blob([partie], { type: mime }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Le navigateur a besoin d'un instant pour démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
