import { useEffect, useState } from 'preact/hooks';
import { ecrireNombre, lireNombre } from './saisie';

type Limites = readonly [number, number];

/**
 * Texte d'un champ numérique. Le champ garde ce que l'utilisateur a tapé, même
 * invalide ; la valeur transmise au reste de la page est toujours valide.
 */
function useSaisieNombre(
  valeur: number | undefined,
  surChangement: (v: number | undefined) => void,
  limites: Limites,
  { optionnel = false, entier = false }: { optionnel?: boolean; entier?: boolean },
) {
  const ecrire = (v: number | undefined) => (v === undefined ? '' : ecrireNombre(v, 3));
  const [texte, setTexte] = useState(() => ecrire(valeur));

  const interpreter = (t: string): { valide: boolean; valeur?: number } => {
    if (t.trim() === '') return { valide: optionnel };
    const lu = lireNombre(t);
    if (lu === null || lu < limites[0] || lu > limites[1] || (entier && !Number.isInteger(lu))) {
      return { valide: false };
    }
    return { valide: true, valeur: lu };
  };

  // La valeur a changé ailleurs (bouton +, préréglage) : le texte la suit.
  useEffect(() => {
    const actuel = interpreter(texte);
    if (!actuel.valide || actuel.valeur !== valeur) setTexte(ecrire(valeur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  const saisir = (t: string) => {
    setTexte(t);
    const lu = interpreter(t);
    if (lu.valide && lu.valeur !== valeur) surChangement(lu.valeur);
  };

  return { texte, saisir, invalide: !interpreter(texte).valide };
}

const plage = ([min, max]: Limites) => `Entre ${ecrireNombre(min)} et ${ecrireNombre(max)}`;

export function ChampNombre(props: {
  id: string;
  etiquette: string;
  valeur: number | undefined;
  surChangement: (v: number | undefined) => void;
  limites: Limites;
  optionnel?: boolean;
  entier?: boolean;
}) {
  const { id, etiquette, limites } = props;
  const { texte, saisir, invalide } = useSaisieNombre(props.valeur, props.surChangement, limites, props);
  return (
    <div class="champ">
      <label for={id}>{etiquette}</label>
      <input
        id={id}
        type="text"
        inputMode={props.entier ? 'numeric' : 'decimal'}
        autocomplete="off"
        value={texte}
        aria-invalid={invalide ? 'true' : undefined}
        aria-describedby={invalide ? `${id}-erreur` : undefined}
        onInput={(e) => saisir(e.currentTarget.value)}
      />
      {invalide && (
        <small id={`${id}-erreur`} class="erreur-champ">
          {plage(limites)}
        </small>
      )}
    </div>
  );
}

/** Compteur de piles : un nombre entier avec ses boutons − et +. */
export function Compteur(props: {
  id: string;
  libelle: string;
  valeur: number;
  surChangement: (v: number) => void;
  limites: Limites;
}) {
  const { id, libelle, valeur, limites } = props;
  const { texte, saisir, invalide } = useSaisieNombre(
    valeur,
    (v) => props.surChangement(v ?? 0),
    limites,
    { entier: true },
  );
  return (
    <div class={valeur > 0 ? 'compteur compteur-actif' : 'compteur'}>
      <span class="compteur-libelle">{libelle}</span>
      <div class="compteur-boutons">
        <button
          type="button"
          aria-label={`Retirer une pile ${libelle}`}
          disabled={valeur <= limites[0]}
          onClick={() => props.surChangement(valeur - 1)}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autocomplete="off"
          aria-label={`Nombre de piles ${libelle}`}
          aria-invalid={invalide ? 'true' : undefined}
          title={invalide ? plage(limites) : undefined}
          value={texte}
          onInput={(e) => saisir(e.currentTarget.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          aria-label={`Ajouter une pile ${libelle}`}
          disabled={valeur >= limites[1]}
          onClick={() => props.surChangement(valeur + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
