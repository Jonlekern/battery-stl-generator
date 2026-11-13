export type Famille = 'cylindrique' | 'rectangulaire' | 'bouton';

interface PileBase {
  /** Identifiant stable, en minuscules. */
  id: string;
  /** Texte de l'étiquette imprimée (« AA », « 4,5V »). */
  nom: string;
  /** Texte affiché dans le formulaire (« AA (LR6) »). */
  libelle: string;
}

export type Pile =
  | (PileBase & { famille: 'cylindrique'; diametre: number; hauteur: number })
  | (PileBase & { famille: 'rectangulaire'; longueur: number; largeur: number; hauteur: number })
  | (PileBase & { famille: 'bouton'; diametre: number; epaisseur: number });

export type Piece = 'corps' | 'etiquettes' | 'tout';

export interface Options {
  jeu: number;
  fond: number;
  paroi: number;
  profondeurPct: number;
  etiquettes: 'aucune' | 'relief' | 'grave';
  encoches: boolean;
}

export interface Demande {
  tiroir: { largeur: number; profondeur: number; hauteur?: number };
  plateau: { largeur: number; profondeur: number };
  /** id de pile -> nombre */
  quantites: Record<string, number>;
  reste: { mode: 'rien' } | { mode: 'usagees' } | { mode: 'plus'; pileId: string };
  options: Options;
}

export interface Zone {
  genre: 'piles' | 'usagees';
  pileId?: string;
  /** Coin avant gauche, relatif à l'insert. */
  x: number;
  y: number;
  largeur: number;
  profondeur: number;
  hauteur: number;
  colonnes: number;
  rangees: number;
  /** Cases tournées de 90°. */
  tournee: boolean;
  etiquette?: { texte: string; hauteurTexte: number };
}

export type Avertissement =
  | { code: 'plateau' }
  | { code: 'hauteur'; pileId: string; hauteurTotale: number }
  | { code: 'etiquette_omise'; pileId: string }
  | { code: 'usagees_impossible' };

export type Erreur =
  | { code: 'ne_rentre_pas'; pileIds: string[] }
  | { code: 'saisie'; champ: string }
  | { code: 'aucune_pile' };

export type Plan =
  | {
      ok: true;
      insert: { largeur: number; profondeur: number; hauteur: number };
      zones: Zone[];
      avertissements: Avertissement[];
    }
  | { ok: false; erreurs: Erreur[] };

export type PlanOk = Extract<Plan, { ok: true }>;

export const OPTIONS_DEFAUT: Options = {
  jeu: 0.4,
  fond: 2,
  paroi: 1.2,
  profondeurPct: 40,
  etiquettes: 'relief',
  encoches: true,
};

/** Bornes [min, max] acceptées pour chaque saisie. */
export const LIMITES = {
  tiroirCote: [30, 1000],
  tiroirHauteur: [10, 500],
  plateauCote: [50, 1000],
  quantite: [0, 500],
  jeu: [0, 2],
  fond: [1, 10],
  paroi: [0.8, 5],
  profondeurPct: [20, 80],
} as const;

/** Constantes de conception, en millimètres sauf mention contraire. */
export const C = {
  /** Jeu retiré à chaque dimension du tiroir. */
  JEU_TIROIR: 1,
  /** Profondeur de la bande d'étiquette à l'avant d'une zone. */
  BANDE: 8,
  TEXTE_MAX: 6,
  TEXTE_MIN: 4,
  /** Largeur d'un caractère, en multiple de la hauteur du texte. */
  FACTEUR_TEXTE: 1.05,
  MARGE_TEXTE: 2,
  /** Profondeur d'une fente de pile bouton, en % du diamètre. */
  PROF_BOUTON_PCT: 55,
  /** Hauteur du bloc au droit d'une encoche de pile bouton, en % du diamètre. */
  ENCOCHE_BOUTON_PCT: 30,
  ENCOCHE_RECT_RAYON: 7,
  /** Épaisseur du relief ou de la gravure des étiquettes. */
  RELIEF: 0.6,
  CHANFREIN_MAX: 0.6,
  RAYON_COIN_RECT: 2,
  PAROI_BAC: 1.6,
  /** Côté minimal de la zone « usagées ». */
  BAC_MIN: 40,
  FN: 48,
} as const;
