import { useEffect, useRef, useState } from 'preact/hooks';
import {
  AmbientLight,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { nombreTriangles, type Maillage } from '../export/stl';

interface Scene3D {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controles: OrbitControls;
  corps: Mesh;
  etiquettes: Mesh;
  dessiner: () => void;
}

function couleurCss(element: Element, variable: string, defaut: string): Color {
  const valeur = getComputedStyle(element).getPropertyValue(variable).trim();
  return new Color(valeur || defaut);
}

function creerScene(conteneur: HTMLDivElement): Scene3D {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  conteneur.appendChild(renderer.domElement);

  const scene = new Scene();
  // Dans OpenSCAD comme sur une imprimante, l'axe Z pointe vers le haut.
  const camera = new PerspectiveCamera(35, 1, 1, 10_000);
  camera.up.set(0, 0, 1);

  scene.add(new AmbientLight(0xffffff, 1.1));
  const soleil = new DirectionalLight(0xffffff, 2.2);
  soleil.position.set(-1, -1.5, 3);
  scene.add(soleil);
  const contre = new DirectionalLight(0xffffff, 0.7);
  contre.position.set(2, 1.5, 1);
  scene.add(contre);

  const corps = new Mesh(
    new BufferGeometry(),
    new MeshStandardMaterial({ color: couleurCss(conteneur, '--couleur-corps', '#b9c0c9'), roughness: 0.75, flatShading: true }),
  );
  const etiquettes = new Mesh(
    new BufferGeometry(),
    new MeshStandardMaterial({ color: couleurCss(conteneur, '--couleur-accent', '#e8590c'), roughness: 0.6, flatShading: true }),
  );
  corps.visible = false;
  etiquettes.visible = false;
  scene.add(corps, etiquettes);

  const controles = new OrbitControls(camera, renderer.domElement);
  const dessiner = () => renderer.render(scene, camera);
  controles.addEventListener('change', dessiner);

  return { renderer, scene, camera, controles, corps, etiquettes, dessiner };
}

function remplacerGeometrie(mesh: Mesh, maillage: Maillage | null): void {
  mesh.geometry.dispose();
  const geometrie = new BufferGeometry();
  if (maillage) {
    geometrie.setAttribute('position', new BufferAttribute(maillage.positions, 3));
    geometrie.computeVertexNormals();
  }
  mesh.geometry = geometrie;
  mesh.visible = maillage !== null;
}

/** Place la caméra pour voir tout le modèle, de trois quarts par l'avant. */
function cadrer(s: Scene3D): void {
  const boite = new Box3().setFromObject(s.corps);
  if (boite.isEmpty()) return;
  const centre = boite.getCenter(new Vector3());
  const rayon = boite.getSize(new Vector3()).length() / 2;
  const distance = rayon / Math.sin((s.camera.fov * Math.PI) / 360);
  const direction = new Vector3(-0.35, -1, 0.9).normalize();
  s.camera.position.copy(centre).addScaledVector(direction, distance * 1.05);
  s.camera.near = distance / 100;
  s.camera.far = distance * 10;
  s.camera.updateProjectionMatrix();
  s.controles.target.copy(centre);
  s.controles.update();
}

/**
 * Aperçu 3D de l'insert. Pendant un calcul, le dernier modèle reste affiché.
 */
export function Vue3D({
  corps,
  etiquettes,
  occupe,
}: {
  corps: Maillage | null;
  etiquettes: Maillage | null;
  occupe: boolean;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const scene3d = useRef<Scene3D | null>(null);
  const [indisponible, setIndisponible] = useState(false);

  // Création de la scène, une seule fois.
  useEffect(() => {
    const element = conteneur.current!;
    let s: Scene3D;
    try {
      s = creerScene(element);
    } catch {
      setIndisponible(true); // pas de WebGL : les téléchargements marchent quand même
      return;
    }
    scene3d.current = s;

    const ajusterTaille = () => {
      const { clientWidth, clientHeight } = element;
      if (clientWidth === 0 || clientHeight === 0) return;
      s.renderer.setSize(clientWidth, clientHeight);
      s.camera.aspect = clientWidth / clientHeight;
      s.camera.updateProjectionMatrix();
      s.dessiner();
    };
    const observateur = new ResizeObserver(ajusterTaille);
    observateur.observe(element);
    ajusterTaille();

    return () => {
      observateur.disconnect();
      s.controles.dispose();
      for (const mesh of [s.corps, s.etiquettes]) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
      }
      s.renderer.dispose();
      s.renderer.domElement.remove();
      scene3d.current = null;
    };
  }, []);

  // Nouveau modèle : on remplace les géométries et on recadre.
  useEffect(() => {
    const s = scene3d.current;
    if (!s) return;
    remplacerGeometrie(s.corps, corps);
    remplacerGeometrie(s.etiquettes, etiquettes);
    cadrer(s);
    s.dessiner();
  }, [corps, etiquettes]);

  const etat = occupe ? 'calcul' : corps ? 'pret' : 'vide';

  return (
    <div
      ref={conteneur}
      class="vue3d"
      data-testid="vue3d"
      data-etat={etat}
      data-triangles={corps ? nombreTriangles(corps) : 0}
    >
      {occupe && (
        <p class="vue3d-message" role="status">
          Calcul de la 3D…
        </p>
      )}
      {indisponible && <p class="vue3d-message">L'aperçu 3D n'est pas disponible sur ce navigateur.</p>}
    </div>
  );
}
