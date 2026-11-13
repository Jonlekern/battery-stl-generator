import { readFile, stat } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const stl = (page: Page) => page.getByRole('button', { name: 'Télécharger le STL' });
const troisMf = (page: Page) => page.getByRole('button', { name: 'Télécharger le 3MF' });
const scad = (page: Page) => page.getByRole('button', { name: 'Télécharger le .scad' });

async function attendre3d(page: Page): Promise<void> {
  await expect(page.getByTestId('vue3d')).toHaveAttribute('data-etat', 'pret', { timeout: 90_000 });
}

async function telecharger(page: Page, bouton: ReturnType<typeof stl>) {
  const [telechargement] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), bouton.click()]);
  const chemin = await telechargement.path();
  return { nom: telechargement.suggestedFilename(), chemin, taille: (await stat(chemin)).size };
}

test('affiche le plan tout de suite, puis la 3D', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));

  await page.goto('./');
  await expect(page.getByTestId('plan2d')).toBeVisible();
  await attendre3d(page);
  const triangles = Number(await page.getByTestId('vue3d').getAttribute('data-triangles'));
  expect(triangles).toBeGreaterThan(100);
  expect(erreurs).toEqual([]);
});

test('télécharge le STL, le 3MF et le .scad', async ({ page }) => {
  await page.goto('./');
  await attendre3d(page);

  const fichierStl = await telecharger(page, stl(page));
  expect(fichierStl.nom).toMatch(/^insert-piles-\d+x\d+\.stl$/);
  expect(fichierStl.taille).toBeGreaterThan(1000);
  // STL binaire : 84 octets d'en-tête, puis 50 octets par triangle.
  const octets = await readFile(fichierStl.chemin);
  expect(octets.length).toBe(84 + octets.readUInt32LE(80) * 50);

  const fichier3mf = await telecharger(page, troisMf(page));
  expect(fichier3mf.nom).toMatch(/^insert-piles-\d+x\d+\.3mf$/);
  expect((await readFile(fichier3mf.chemin)).subarray(0, 2).toString()).toBe('PK');
  expect(fichier3mf.taille).toBeGreaterThan(1000);

  const fichierScad = await telecharger(page, scad(page));
  expect(fichierScad.nom).toMatch(/^insert-piles-\d+x\d+\.scad$/);
  expect(await readFile(fichierScad.chemin, 'utf8')).toContain('module insert()');
});

test('accepte la virgule décimale et signale une saisie invalide', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Réglages avancés').click();
  const jeu = page.getByLabel('Jeu (mm)');

  await jeu.fill('0,6');
  await expect(jeu).not.toHaveAttribute('aria-invalid', 'true');

  await jeu.fill('abc');
  await expect(jeu).toHaveAttribute('aria-invalid', 'true');
  // Le plan reste affiché avec la dernière valeur valide.
  await expect(page.getByTestId('plan2d')).toBeVisible();

  await jeu.fill('');
  await expect(jeu).toHaveAttribute('aria-invalid', 'true');
});

test('bloque les téléchargements quand ça ne rentre pas', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Largeur intérieure (mm)').fill('30');
  await page.getByLabel('Profondeur intérieure (mm)').fill('30');
  await page.getByRole('button', { name: 'Ajouter une pile D (LR20)' }).click();

  await expect(page.getByText('Ça ne rentre pas dans le tiroir')).toBeVisible();
  await expect(stl(page)).toBeDisabled();
  await expect(troisMf(page)).toBeDisabled();
  await expect(scad(page)).toBeDisabled();
});

test('retient les réglages après rechargement', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Largeur intérieure (mm)').fill('250');
  await page.getByRole('button', { name: 'Ajouter une pile C (LR14)' }).click();
  await expect(page.getByLabel('Nombre de piles C (LR14)')).toHaveValue('1');

  await page.reload();
  await expect(page.getByLabel('Largeur intérieure (mm)')).toHaveValue('250');
  await expect(page.getByLabel('Nombre de piles C (LR14)')).toHaveValue('1');
});

for (const hauteur of [900, 600]) {
  test(`garde les boutons de téléchargement accessibles sur un écran de ${hauteur} px de haut`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: hauteur });
    await page.goto('./');
    await attendre3d(page);
    for (const bouton of [stl(page), troisMf(page), scad(page)]) {
      await bouton.scrollIntoViewIfNeeded();
      await expect(bouton).toBeInViewport({ ratio: 1 });
    }
    // L'aperçu 3D aussi doit pouvoir être amené entièrement à l'écran.
    await page.getByTestId('vue3d').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('vue3d')).toBeInViewport({ ratio: 1 });
  });
}

test('sur grand écran, le bandeau de résumé est masqué', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('plan2d')).toBeVisible();
  await expect(page.getByRole('link', { name: /Voir le résultat/ })).toBeHidden();
});

test.describe('sur téléphone', () => {
  // Émulation d'un vrai téléphone : écran tactile, fenêtre d'affichage mobile et
  // écran à haute densité. Sans la haute densité, le canevas 3D ne déborde pas
  // et le défaut de largeur passe inaperçu.
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('la page tient dans la largeur de l\'écran', async ({ page }) => {
    await page.goto('./');
    await attendre3d(page);
    const largeurs = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      fenetre: window.innerWidth,
    }));
    expect(largeurs).toEqual({ page: 390, fenetre: 390 });
  });

  test('un bandeau résume le résultat et y conduit', async ({ page }) => {
    await page.goto('./');
    const bandeau = page.getByRole('link', { name: /Voir le résultat/ });
    await expect(bandeau).toBeInViewport({ ratio: 1 });
    await expect(bandeau).toContainText('alvéoles');
    await expect(page.getByTestId('plan2d')).not.toBeInViewport();

    await bandeau.tap();
    await expect(page.getByTestId('vue3d')).toBeInViewport();
  });

  test('les boutons de téléchargement ne sont pas cachés par le bandeau', async ({ page }) => {
    await page.goto('./');
    await attendre3d(page);
    const bouton = stl(page);
    await bouton.scrollIntoViewIfNeeded();
    const [zoneBouton, zoneBandeau] = await Promise.all([
      bouton.boundingBox(),
      page.getByRole('link', { name: /Voir le résultat/ }).boundingBox(),
    ]);
    expect(zoneBouton!.y + zoneBouton!.height).toBeLessThanOrEqual(zoneBandeau!.y);
  });
});
