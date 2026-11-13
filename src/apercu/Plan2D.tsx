import { pileParId } from '../catalogue';
import { caseDe, centreAlveole } from '../placement/cases';
import { C, type Demande, type Pile, type PlanOk, type Zone } from '../types';

/** Nombre écrit dans le SVG : 3 décimales au plus. */
const n = (v: number) => Math.round(v * 1000) / 1000;

/** La hauteur des capitales vaut environ 0,716 fois le corps de la police. */
const CORPS_PAR_HAUTEUR = 1 / 0.716;

function Alveoles({ zone, pile, demande, yHaut }: { zone: Zone; pile: Pile; demande: Demande; yHaut: (y: number) => number }) {
  const o = demande.options;
  const c = caseDe(pile, o, zone.tournee);
  const formes = [];
  for (let i = 0; i < zone.colonnes; i++) {
    for (let j = 0; j < zone.rangees; j++) {
      const centre = centreAlveole(c, o, i, j);
      const cx = zone.x + centre.x;
      const cy = yHaut(zone.y + centre.y);
      if (pile.famille === 'cylindrique') {
        formes.push(<circle class="alveole" cx={n(cx)} cy={n(cy)} r={n((pile.diametre + o.jeu) / 2)} />);
        continue;
      }
      // Dimensions de la découpe vue de dessus, avant rotation.
      const long = (pile.famille === 'rectangulaire' ? pile.longueur : pile.diametre) + o.jeu;
      const court = (pile.famille === 'rectangulaire' ? pile.largeur : pile.epaisseur) + o.jeu;
      const lx = zone.tournee ? court : long;
      const ly = zone.tournee ? long : court;
      formes.push(
        <rect
          class="alveole"
          x={n(cx - lx / 2)}
          y={n(cy - ly / 2)}
          width={n(lx)}
          height={n(ly)}
          rx={pile.famille === 'rectangulaire' ? C.RAYON_COIN_RECT : 0}
        />,
      );
    }
  }
  return <>{formes}</>;
}

/**
 * Plan de l'insert vu de dessus, à l'échelle. L'avant du tiroir est en bas.
 */
export function Plan2D({ plan, demande }: { plan: PlanOk; demande: Demande }) {
  const { largeur, profondeur } = plan.insert;
  // Le SVG a son axe Y vers le bas : on le retourne pour mettre l'avant en bas.
  const yHaut = (y: number) => profondeur - y;

  return (
    <svg
      data-testid="plan2d"
      class="plan2d"
      viewBox={`0 0 ${n(largeur)} ${n(profondeur)}`}
      role="img"
      aria-label={`Plan de l'insert, ${Math.round(largeur)} par ${Math.round(profondeur)} millimètres`}
    >
      <rect class="plaque" x="0" y="0" width={n(largeur)} height={n(profondeur)} />
      {plan.zones.map((zone) => {
        const pile = zone.pileId ? pileParId(zone.pileId) : undefined;
        const usagees = zone.genre === 'usagees';
        const titre = pile ? `${pile.libelle} : ${zone.colonnes * zone.rangees} alvéoles` : 'Piles usagées';
        const yTexte = usagees
          ? zone.y + C.PAROI_BAC + 2 + (zone.etiquette?.hauteurTexte ?? 0) / 2
          : zone.y + C.BANDE / 2;
        return (
          <g>
            <rect
              class={usagees ? 'zone zone-usagees' : 'zone'}
              x={n(zone.x)}
              y={n(yHaut(zone.y + zone.profondeur))}
              width={n(zone.largeur)}
              height={n(zone.profondeur)}
            >
              <title>{titre}</title>
            </rect>
            {pile && <Alveoles zone={zone} pile={pile} demande={demande} yHaut={yHaut} />}
            {zone.etiquette && (
              <text
                class="etiquette"
                x={n(zone.x + zone.largeur / 2)}
                y={n(yHaut(yTexte))}
                font-size={n(zone.etiquette.hauteurTexte * CORPS_PAR_HAUTEUR)}
                text-anchor="middle"
                dominant-baseline="central"
              >
                {zone.etiquette.texte}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
