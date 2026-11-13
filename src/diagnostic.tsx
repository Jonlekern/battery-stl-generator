import { useEffect, useState } from 'preact/hooks';
import { lireStl, nombreTriangles } from './export/stl';
import { creerMoteur } from './moteur/client';

type Etat = { etat: 'calcul' } | { etat: 'ok'; triangles: number } | { etat: 'erreur'; message: string };

/** Page de contrôle (?diagnostic=1) : vérifie que le moteur 3D tourne dans ce navigateur. */
export function Diagnostic() {
  const [etat, setEtat] = useState<Etat>({ etat: 'calcul' });

  useEffect(() => {
    creerMoteur()
      .rendre('cube(10);', 'tout')
      .then((stl) => setEtat({ etat: 'ok', triangles: nombreTriangles(lireStl(stl)) }))
      .catch((e: unknown) => setEtat({ etat: 'erreur', message: e instanceof Error ? e.message : String(e) }));
  }, []);

  return (
    <main>
      <h1>Diagnostic du moteur 3D</h1>
      {etat.etat === 'calcul' && <p>Calcul d'un cube de test…</p>}
      {etat.etat === 'ok' && (
        <p>
          Le moteur fonctionne. Triangles du cube : <span data-testid="diag-triangles">{etat.triangles}</span>
        </p>
      )}
      {etat.etat === 'erreur' && (
        <p>
          Le moteur ne fonctionne pas : <span data-testid="diag-erreur">{etat.message}</span>
        </p>
      )}
    </main>
  );
}
