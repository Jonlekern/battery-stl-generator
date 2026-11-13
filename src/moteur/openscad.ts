import { createOpenSCAD } from 'openscad-wasm-prebuilt';
import type { Piece } from '../types';

/** Échec d'un rendu. `journal` contient la sortie d'OpenSCAD. */
export class ErreurOpenScad extends Error {
  journal: string[];

  constructor(message: string, journal: string[]) {
    super(message);
    this.name = 'ErreurOpenScad';
    this.journal = journal;
  }
}

// Arimo Bold a le même dessin que Liberation Sans Bold, la police fournie avec
// OpenSCAD sur PC. On la déclare sous ce nom pour que le même .scad donne le
// même résultat dans le navigateur et sur PC.
const CONF_POLICES = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
<dir>/fonts</dir>
<alias binding="same"><family>Liberation Sans</family><prefer><family>Arimo</family></prefer></alias>
</fontconfig>
`;

/**
 * Rend un fichier .scad en STL binaire.
 *
 * Chaque appel crée une instance neuve d'OpenSCAD : une instance ne supporte
 * qu'un seul rendu.
 */
export async function rendre(scad: string, piece: Piece, police: Uint8Array): Promise<Uint8Array> {
  const journal: string[] = [];
  const openscad = await createOpenSCAD({
    print: (t) => journal.push(t),
    printErr: (t) => journal.push(t),
  });
  const instance = openscad.getInstance();
  instance.FS.mkdir('/fonts');
  instance.FS.writeFile('/fonts/Arimo-Bold.ttf', police);
  instance.FS.writeFile('/fonts/fonts.conf', CONF_POLICES);
  instance.FS.writeFile('/in.scad', scad);

  let code: number;
  try {
    code = instance.callMain([
      '/in.scad',
      '--backend=manifold',
      '--export-format=binstl',
      '-D',
      `piece="${piece}"`,
      '-o',
      '/out.stl',
    ]);
  } catch (e) {
    throw new ErreurOpenScad(`OpenSCAD a planté : ${String(e)}`, journal);
  }
  if (code !== 0) {
    throw new ErreurOpenScad(`OpenSCAD a rendu le code ${code}`, journal);
  }
  return instance.FS.readFile('/out.stl', { encoding: 'binary' });
}
