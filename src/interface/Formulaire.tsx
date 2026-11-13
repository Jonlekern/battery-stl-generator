import { useState } from 'preact/hooks';
import { PILES } from '../catalogue';
import { LIMITES, type Demande, type Famille, type Options } from '../types';
import { ChampNombre, Compteur } from './ChampNombre';
import { IMPRIMANTES } from './imprimantes';

const FAMILLES: { famille: Famille; titre: string }[] = [
  { famille: 'cylindrique', titre: 'Cylindriques' },
  { famille: 'rectangulaire', titre: 'Rectangulaires' },
  { famille: 'bouton', titre: 'Piles bouton' },
];

const PERSONNALISE = 'personnalise';

function imprimanteCorrespondante(d: Demande): string {
  const trouvee = IMPRIMANTES.find(
    (i) => i.largeur === d.plateau.largeur && i.profondeur === d.plateau.profondeur,
  );
  return trouvee ? trouvee.nom : PERSONNALISE;
}

export function Formulaire({ demande, surChangement }: { demande: Demande; surChangement: (d: Demande) => void }) {
  const [imprimante, setImprimante] = useState(() => imprimanteCorrespondante(demande));
  // Les familles qui contiennent déjà des piles sont dépliées à l'ouverture.
  const [ouvertes] = useState(
    () =>
      new Set(
        FAMILLES.filter(
          ({ famille }) =>
            famille !== 'bouton' ||
            PILES.some((p) => p.famille === 'bouton' && (demande.quantites[p.id] ?? 0) > 0),
        ).map((f) => f.famille),
      ),
  );

  const changer = (partie: Partial<Demande>) => surChangement({ ...demande, ...partie });
  const changerOptions = (partie: Partial<Options>) => changer({ options: { ...demande.options, ...partie } });
  const changerQuantite = (id: string, q: number) => {
    const quantites = { ...demande.quantites, [id]: q };
    if (q === 0) delete quantites[id];
    changer({ quantites });
  };

  const choisirImprimante = (nom: string) => {
    setImprimante(nom);
    const preset = IMPRIMANTES.find((i) => i.nom === nom);
    if (preset) changer({ plateau: { largeur: preset.largeur, profondeur: preset.profondeur } });
  };

  const o = demande.options;

  return (
    <form class="formulaire" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Tiroir</legend>
        <p class="aide">Les dimensions intérieures, là où l'insert sera posé.</p>
        <div class="grille-champs">
          <ChampNombre
            id="tiroir-largeur"
            etiquette="Largeur intérieure (mm)"
            valeur={demande.tiroir.largeur}
            limites={LIMITES.tiroirCote}
            surChangement={(v) => v !== undefined && changer({ tiroir: { ...demande.tiroir, largeur: v } })}
          />
          <ChampNombre
            id="tiroir-profondeur"
            etiquette="Profondeur intérieure (mm)"
            valeur={demande.tiroir.profondeur}
            limites={LIMITES.tiroirCote}
            surChangement={(v) => v !== undefined && changer({ tiroir: { ...demande.tiroir, profondeur: v } })}
          />
          <ChampNombre
            id="tiroir-hauteur"
            etiquette="Hauteur utile (mm, facultatif)"
            valeur={demande.tiroir.hauteur}
            limites={LIMITES.tiroirHauteur}
            optionnel
            surChangement={(v) => {
              const { hauteur: _ancienne, ...tiroir } = demande.tiroir;
              changer({ tiroir: v === undefined ? tiroir : { ...tiroir, hauteur: v } });
            }}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Imprimante</legend>
        <div class="grille-champs">
          <div class="champ">
            <label for="imprimante">Plateau d'impression</label>
            <select id="imprimante" value={imprimante} onChange={(e) => choisirImprimante(e.currentTarget.value)}>
              {IMPRIMANTES.map((i) => (
                <option value={i.nom}>
                  {i.nom} ({i.largeur} × {i.profondeur})
                </option>
              ))}
              <option value={PERSONNALISE}>Personnalisé</option>
            </select>
          </div>
          {imprimante === PERSONNALISE && (
            <>
              <ChampNombre
                id="plateau-largeur"
                etiquette="Largeur du plateau (mm)"
                valeur={demande.plateau.largeur}
                limites={LIMITES.plateauCote}
                surChangement={(v) => v !== undefined && changer({ plateau: { ...demande.plateau, largeur: v } })}
              />
              <ChampNombre
                id="plateau-profondeur"
                etiquette="Profondeur du plateau (mm)"
                valeur={demande.plateau.profondeur}
                limites={LIMITES.plateauCote}
                surChangement={(v) => v !== undefined && changer({ plateau: { ...demande.plateau, profondeur: v } })}
              />
            </>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>Piles</legend>
        <p class="aide">Combien de piles de chaque type veux-tu ranger ?</p>
        {FAMILLES.map(({ famille, titre }) => {
          const piles = PILES.filter((p) => p.famille === famille);
          const choisies = piles.filter((p) => (demande.quantites[p.id] ?? 0) > 0).length;
          return (
            <details class="famille" open={ouvertes.has(famille)}>
              <summary>
                {titre}
                {choisies > 0 && <span class="pastille">{choisies}</span>}
              </summary>
              <div class="grille-compteurs">
                {piles.map((p) => (
                  <Compteur
                    id={`quantite-${p.id}`}
                    libelle={p.libelle}
                    valeur={demande.quantites[p.id] ?? 0}
                    limites={LIMITES.quantite}
                    surChangement={(q) => changerQuantite(p.id, q)}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </fieldset>

      <fieldset>
        <legend>Reste du tiroir</legend>
        <div class="choix">
          <label>
            <input
              type="radio"
              name="reste"
              checked={demande.reste.mode === 'rien'}
              onChange={() => changer({ reste: { mode: 'rien' } })}
            />
            <span>
              <strong>Rien</strong> : un insert compact, plus petit que le tiroir
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="reste"
              checked={demande.reste.mode === 'usagees'}
              onChange={() => changer({ reste: { mode: 'usagees' } })}
            />
            <span>
              <strong>Zone « usagées »</strong> : un bac pour les piles à recycler
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="reste"
              checked={demande.reste.mode === 'plus'}
              onChange={() =>
                changer({
                  reste: { mode: 'plus', pileId: demande.reste.mode === 'plus' ? demande.reste.pileId : 'aa' },
                })
              }
            />
            <span>
              <strong>Plus de piles</strong> : remplir l'espace libre avec un type
            </span>
          </label>
        </div>
        {demande.reste.mode === 'plus' && (
          <div class="champ">
            <label for="reste-pile">Type de pile à ajouter</label>
            <select
              id="reste-pile"
              value={demande.reste.pileId}
              onChange={(e) => changer({ reste: { mode: 'plus', pileId: e.currentTarget.value } })}
            >
              {PILES.map((p) => (
                <option value={p.id}>{p.libelle}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Options</legend>
        <div class="grille-champs">
          <div class="champ">
            <label for="etiquettes">Étiquettes</label>
            <select
              id="etiquettes"
              value={o.etiquettes}
              onChange={(e) => changerOptions({ etiquettes: e.currentTarget.value as Options['etiquettes'] })}
            >
              <option value="relief">En relief</option>
              <option value="grave">Gravées</option>
              <option value="aucune">Aucune</option>
            </select>
          </div>
        </div>
        <label class="case">
          <input
            type="checkbox"
            checked={o.encoches}
            onChange={(e) => changerOptions({ encoches: e.currentTarget.checked })}
          />
          <span>Encoches pour les doigts (piles bouton, 9V et 4,5V)</span>
        </label>

        <details class="avance">
          <summary>Réglages avancés</summary>
          <div class="grille-champs">
            <ChampNombre
              id="jeu"
              etiquette="Jeu (mm)"
              valeur={o.jeu}
              limites={LIMITES.jeu}
              surChangement={(v) => v !== undefined && changerOptions({ jeu: v })}
            />
            <ChampNombre
              id="fond"
              etiquette="Épaisseur du fond (mm)"
              valeur={o.fond}
              limites={LIMITES.fond}
              surChangement={(v) => v !== undefined && changerOptions({ fond: v })}
            />
            <ChampNombre
              id="paroi"
              etiquette="Paroi minimale (mm)"
              valeur={o.paroi}
              limites={LIMITES.paroi}
              surChangement={(v) => v !== undefined && changerOptions({ paroi: v })}
            />
            <ChampNombre
              id="profondeur-alveole"
              etiquette="Profondeur d'alvéole (%)"
              valeur={o.profondeurPct}
              limites={LIMITES.profondeurPct}
              surChangement={(v) => v !== undefined && changerOptions({ profondeurPct: v })}
            />
          </div>
          <p class="aide">
            Le jeu s'ajoute à la taille de chaque pile. Augmente-le si les piles forcent, baisse-le si elles
            flottent.
          </p>
        </details>
      </fieldset>
    </form>
  );
}
