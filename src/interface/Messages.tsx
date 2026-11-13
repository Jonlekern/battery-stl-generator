import type { Demande, Plan } from '../types';
import { texteAvertissement, texteErreur } from './messages';

/** Erreurs bloquantes et avertissements du plan, plus l'éventuel souci du moteur 3D. */
export function Messages({ plan, demande, erreur3d }: { plan: Plan; demande: Demande; erreur3d: string | null }) {
  const erreurs = plan.ok ? [] : plan.erreurs.map(texteErreur);
  const avertissements = plan.ok ? plan.avertissements.map((a) => texteAvertissement(a, plan, demande)) : [];
  if (erreur3d) erreurs.push(erreur3d);

  if (erreurs.length === 0 && avertissements.length === 0) return null;
  return (
    <div class="messages">
      {erreurs.length > 0 && (
        <ul class="message message-erreur" role="alert">
          {erreurs.map((texte) => (
            <li>{texte}</li>
          ))}
        </ul>
      )}
      {avertissements.length > 0 && (
        <ul class="message message-avertissement" role="status">
          {avertissements.map((texte) => (
            <li>{texte}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
