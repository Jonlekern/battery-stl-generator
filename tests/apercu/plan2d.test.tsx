import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { Plan2D } from '../../src/apercu/Plan2D';
import { OPTIONS_DEFAUT } from '../../src/types';
import { demande, planOk } from '../aide/rendu';

const compter = (texte: string, motif: RegExp) => (texte.match(motif) ?? []).length;

function svg(d: ReturnType<typeof demande>): string {
  return render(<Plan2D plan={planOk(d)} demande={d} />);
}

describe('Plan2D', () => {
  it('dessine une zone, ses 12 alvéoles rondes et son étiquette', () => {
    const s = svg(demande({ quantites: { aa: 12 } }));
    expect(s).toContain('data-testid="plan2d"');
    expect(s).toContain('viewBox="0 0 65.6 57.5"');
    expect(compter(s, /<rect[^>]*class="zone[ "]/g)).toBe(1);
    expect(compter(s, /<circle[^>]*class="alveole"/g)).toBe(12);
    expect(compter(s, /<text/g)).toBe(1);
    expect(s).toMatch(/<text[^>]*>AA<\/text>/);
  });

  it('dessine les alvéoles rondes au bon diamètre et au bon endroit', () => {
    const s = svg(demande({ quantites: { aa: 12 }, options: { ...OPTIONS_DEFAUT, etiquettes: 'aucune' } }));
    // Première alvéole : centre à 0,6 + 8,05 du coin avant gauche, rayon 7,45.
    // L'avant du tiroir est en bas du dessin : y = 49,5 - 8,65.
    expect(s).toContain('cx="8.65" cy="40.85" r="7.45"');
    expect(compter(s, /<text/g)).toBe(0);
  });

  it('dessine des rectangles pour les fentes de piles bouton', () => {
    const s = svg(demande({ quantites: { aa: 8, cr2032: 6 } }));
    expect(compter(s, /<rect[^>]*class="zone[ "]/g)).toBe(2);
    expect(compter(s, /<circle[^>]*class="alveole"/g)).toBe(8);
    expect(compter(s, /<rect[^>]*class="alveole"/g)).toBe(6);
  });

  it('dessine les poches des piles rectangulaires', () => {
    const s = svg(demande({ quantites: { '9v': 2 } }));
    expect(compter(s, /<rect[^>]*class="alveole"/g)).toBe(2);
    // Zone tournée : la poche fait 17,9 de large et 26,9 de profondeur.
    expect(s).toMatch(/<rect[^>]*class="alveole"[^>]*width="17.9"[^>]*height="26.9"/);
  });

  it('dessine le bac des piles usagées et son étiquette', () => {
    const s = svg(demande({ quantites: { aa: 12 }, reste: { mode: 'usagees' } }));
    expect(s).toContain('viewBox="0 0 299 399"');
    expect(compter(s, /<rect[^>]*class="zone zone-usagees"/g)).toBe(1);
    expect(s).toMatch(/<text[^>]*>USAGÉES<\/text>/);
  });

  it('nomme chaque zone pour les lecteurs d\'écran et le survol', () => {
    const s = svg(demande({ quantites: { aa: 12 } }));
    expect(s).toContain('<title>AA (LR6) : 12 alvéoles</title>');
  });
});
