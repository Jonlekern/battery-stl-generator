/**
 * Lit un nombre tapé par l'utilisateur. Accepte la virgule française comme le
 * point. Rend `null` pour un champ vide ou un texte qui n'est pas un nombre.
 */
export function lireNombre(texte: string): number | null {
  const propre = texte.trim();
  if (!/^-?\d+([.,]\d+)?$/.test(propre)) return null;
  return Number(propre.replace(',', '.'));
}

/** Écrit un nombre à la française, avec une décimale au plus par défaut. */
export function ecrireNombre(v: number, decimales = 1): string {
  const facteur = 10 ** decimales;
  return String(Math.round(v * facteur) / facteur).replace('.', ',');
}
