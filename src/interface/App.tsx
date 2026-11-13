import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Plan2D } from '../apercu/Plan2D';
import { Vue3D } from '../apercu/Vue3D';
import { TYPES_MIME, nomFichier, telecharger } from '../export/fichiers';
import { lireStl, type Maillage } from '../export/stl';
import { creer3mf } from '../export/troismf';
import { creerMoteur, type Moteur } from '../moteur/client';
import { ErreurChargement } from '../moteur/erreurs';
import { calculerPlan, nombreAlveoles } from '../placement';
import { aDesEtiquettes, genererScad } from '../scad/generer';
import type { Demande } from '../types';
import { creerCalcul3d, type Calcul3d } from './calcul3d';
import { chargerDemande, sauverDemande } from './etat';
import { Formulaire } from './Formulaire';
import { Messages } from './Messages';
import { LIEN_OPENSCAD, MESSAGE_CALCUL_ECHOUE, MESSAGE_MOTEUR_ABSENT, PIED_DE_PAGE } from './messages';
import { ecrireNombre } from './saisie';

/** Le dernier modèle 3D calculé, et le .scad dont il vient. */
interface Modele {
  scad: string;
  stlCorps: Uint8Array;
  corps: Maillage;
  etiquettes: Maillage | null;
}

export function App() {
  const [demande, setDemande] = useState<Demande>(chargerDemande);
  const plan = useMemo(() => calculerPlan(demande), [demande]);
  const scad = useMemo(() => (plan.ok ? genererScad(plan, demande) : null), [plan, demande]);

  const [modele, setModele] = useState<Modele | null>(null);
  const [erreur3d, setErreur3d] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const calcul = useRef<Calcul3d | null>(null);
  const moteurExport = useRef<Moteur | null>(null);
  // Le .scad de la dernière demande de rendu : c'est à lui qu'appartient le prochain résultat.
  const scadDemande = useRef<string | null>(null);

  useEffect(() => {
    const c = creerCalcul3d(creerMoteur(), (r) => {
      if (r.etat === 'pret' && scadDemande.current !== null) {
        setModele({
          scad: scadDemande.current,
          stlCorps: r.corps,
          corps: lireStl(r.corps),
          etiquettes: r.etiquettes ? lireStl(r.etiquettes) : null,
        });
        setErreur3d(null);
      } else if (r.etat === 'erreur') {
        setErreur3d(r.message);
      }
    });
    calcul.current = c;
    return () => c.arreter();
  }, []);

  useEffect(() => sauverDemande(demande), [demande]);

  useEffect(() => {
    setErreur3d(null);
    scadDemande.current = scad;
    if (scad !== null && plan.ok) calcul.current?.demander(scad, aDesEtiquettes(plan));
    else calcul.current?.arreter();
  }, [scad]);

  const aJour = modele !== null && modele.scad === scad;
  const occupe = scad !== null && !aJour && erreur3d === null;
  const pretAExporter = aJour && !exportEnCours;

  async function telechargerStl(): Promise<void> {
    if (!plan.ok || !modele || scad === null) return;
    const nom = nomFichier(plan, 'stl');
    // Sans relief, la pièce complète est le corps déjà calculé.
    if (demande.options.etiquettes !== 'relief' || !modele.etiquettes) {
      telecharger(modele.stlCorps, nom, TYPES_MIME.stl);
      return;
    }
    setExportEnCours(true);
    try {
      moteurExport.current ??= creerMoteur();
      telecharger(await moteurExport.current.rendre(scad, 'tout'), nom, TYPES_MIME.stl);
    } catch (e) {
      setErreur3d(e instanceof ErreurChargement ? MESSAGE_MOTEUR_ABSENT : MESSAGE_CALCUL_ECHOUE);
    } finally {
      setExportEnCours(false);
    }
  }

  function telecharger3mf(): void {
    if (!plan.ok || !modele) return;
    const pieces = [{ nom: 'corps', maillage: modele.corps }];
    if (modele.etiquettes) pieces.push({ nom: 'etiquettes', maillage: modele.etiquettes });
    telecharger(creer3mf(pieces), nomFichier(plan, '3mf'), TYPES_MIME['3mf']);
  }

  function telechargerScad(): void {
    if (!plan.ok || scad === null) return;
    telecharger(scad, nomFichier(plan, 'scad'), TYPES_MIME.scad);
  }

  const mm = (v: number) => ecrireNombre(v);
  const resume = plan.ok
    ? {
        dimensions: `${mm(plan.insert.largeur)} × ${mm(plan.insert.profondeur)} × ${mm(plan.insert.hauteur)} mm`,
        alveoles: plan.zones.reduce((n, z) => n + nombreAlveoles(z), 0),
      }
    : null;

  return (
    <div class="page">
      <header class="entete">
        <h1>Insert Piles</h1>
        <p>Un insert de tiroir sur mesure pour ranger tes piles, prêt à imprimer en 3D.</p>
      </header>

      <main class="colonnes">
        <section class="reglages" aria-label="Réglages">
          <Formulaire demande={demande} surChangement={setDemande} />
        </section>

        <section class="resultat" id="resultat" aria-label="Résultat">
          <Messages plan={plan} demande={demande} erreur3d={erreur3d} />

          {resume && (
            <p class="resume">
              Insert de <strong>{resume.dimensions}</strong>, {resume.alveoles} alvéoles
            </p>
          )}

          <div class="telechargements">
            <button type="button" class="principal" disabled={!pretAExporter} onClick={() => void telechargerStl()}>
              Télécharger le STL
            </button>
            <button type="button" disabled={!pretAExporter} onClick={telecharger3mf}>
              Télécharger le 3MF
            </button>
            <button type="button" disabled={scad === null} onClick={telechargerScad}>
              Télécharger le .scad
            </button>
          </div>

          <figure class="cadre">
            <Vue3D corps={modele?.corps ?? null} etiquettes={modele?.etiquettes ?? null} occupe={occupe} />
            <figcaption>Aperçu 3D. Fais glisser pour tourner, pince ou molette pour zoomer.</figcaption>
          </figure>

          {plan.ok && (
            <figure class="cadre">
              <Plan2D plan={plan} demande={demande} />
              <figcaption>Vue de dessus. L'avant du tiroir est en bas.</figcaption>
            </figure>
          )}

          <p class="aide">
            Le 3MF contient le corps et les étiquettes en deux pièces : donne une couleur à chacune dans ton
            slicer. Le .scad s'ouvre dans OpenSCAD pour être modifié.
          </p>
        </section>
      </main>

      {/* Sur téléphone, le résultat est loin sous les réglages : ce bandeau y conduit. */}
      <a class="bandeau" href="#resultat">
        <span>{resume ? `${resume.dimensions}, ${resume.alveoles} alvéoles` : 'Réglages à corriger'}</span>
        <strong>Voir le résultat ↓</strong>
      </a>

      <footer class="pied">
        <p>
          {PIED_DE_PAGE}{' '}
          <a href={LIEN_OPENSCAD} target="_blank" rel="noreferrer">
            Sources d'OpenSCAD
          </a>
        </p>
      </footer>
    </div>
  );
}
