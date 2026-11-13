import { pileParId } from '../catalogue';
import { caseDe } from '../placement/cases';
import type { Demande, PlanOk, Zone } from '../types';
import bibliotheque from './insert_piles.scad?raw';

/** Nombre écrit pour OpenSCAD : 3 décimales au plus, sans zéros inutiles. */
function nombre(v: number): string {
  const arrondi = Math.round(v * 1000) / 1000;
  return String(Object.is(arrondi, -0) ? 0 : arrondi);
}

function chaine(texte: string): string {
  return `"${texte.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Une zone, dans l'ordre attendu par insert_piles.scad :
 * [genre, x, y, largeur, profondeur, hauteur, colonnes, rangees, tournee,
 *  pasX, pasY, a, b, profAlveole, texte, hauteurTexte]
 */
function ligneZone(z: Zone, d: Demande): string {
  let genre: string;
  let pasX = 0;
  let pasY = 0;
  let a = 0;
  let b = 0;
  let profAlveole: number;

  const pile = z.genre === 'piles' && z.pileId ? pileParId(z.pileId) : undefined;
  if (pile) {
    const c = caseDe(pile, d.options, z.tournee);
    pasX = c.pasX;
    pasY = c.pasY;
    profAlveole = c.profondeurAlveole;
    switch (pile.famille) {
      case 'cylindrique':
        genre = 'cyl';
        a = pile.diametre;
        break;
      case 'rectangulaire':
        genre = 'rect';
        a = pile.longueur;
        b = pile.largeur;
        break;
      case 'bouton':
        genre = 'bouton';
        a = pile.diametre;
        b = pile.epaisseur;
        break;
    }
  } else {
    genre = 'bac';
    profAlveole = z.hauteur - d.options.fond;
  }

  const champs = [
    chaine(genre),
    nombre(z.x),
    nombre(z.y),
    nombre(z.largeur),
    nombre(z.profondeur),
    nombre(z.hauteur),
    nombre(z.colonnes),
    nombre(z.rangees),
    String(z.tournee),
    nombre(pasX),
    nombre(pasY),
    nombre(a),
    nombre(b),
    nombre(profAlveole),
    chaine(z.etiquette?.texte ?? ''),
    nombre(z.etiquette?.hauteurTexte ?? 0),
  ];
  return `  [${champs.join(', ')}],`;
}

/** Vrai si la pièce « etiquettes » contient quelque chose à rendre. */
export function aDesEtiquettes(plan: PlanOk): boolean {
  return plan.zones.some((z) => z.etiquette !== undefined);
}

/** Produit un fichier .scad autonome : paramètres, zones, puis la bibliothèque. */
export function genererScad(plan: PlanOk, d: Demande): string {
  const o = d.options;
  const entete = [
    '// Insert Piles : fichier généré. S\'ouvre tel quel dans OpenSCAD.',
    'piece = "tout"; // "corps", "etiquettes" ou "tout"',
    `fond = ${nombre(o.fond)}; jeu = ${nombre(o.jeu)}; paroi = ${nombre(o.paroi)};`,
    `mode_etiquettes = "${o.etiquettes}"; // "aucune", "relief" ou "grave"`,
    `encoches = ${o.encoches};`,
    `insert = [${nombre(plan.insert.largeur)}, ${nombre(plan.insert.profondeur)}];`,
    '// [genre, x, y, largeur, profondeur, hauteur, colonnes, rangees, tournee,',
    '//  pasX, pasY, a, b, profAlveole, texte, hauteurTexte]',
    'zones = [',
    ...plan.zones.map((z) => ligneZone(z, d)),
    '];',
    '',
  ];
  return entete.join('\n') + '\n' + bibliotheque;
}
