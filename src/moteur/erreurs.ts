// Ce module ne dépend de rien : la page peut l'importer sans embarquer OpenSCAD.

/** Échec d'un rendu. `journal` contient la sortie d'OpenSCAD. */
export class ErreurOpenScad extends Error {
  journal: string[];

  constructor(message: string, journal: string[] = []) {
    super(message);
    this.name = 'ErreurOpenScad';
    this.journal = journal;
  }
}

/** Le rendu a été abandonné parce qu'un autre l'a remplacé. */
export class ErreurAnnulee extends Error {
  constructor() {
    super('Rendu annulé');
    this.name = 'ErreurAnnulee';
  }
}

/** Le moteur lui-même n'a pas pu démarrer (Worker ou WASM non chargé). */
export class ErreurChargement extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurChargement';
  }
}
