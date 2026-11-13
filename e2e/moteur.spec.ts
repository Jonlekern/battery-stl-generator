import { expect, test } from '@playwright/test';

test('le moteur OpenSCAD tourne dans un Web Worker', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text());
  });
  page.on('pageerror', (e) => erreurs.push(String(e)));

  await page.goto('./?diagnostic=1');

  // Un cube a 12 triangles.
  await expect(page.getByTestId('diag-triangles')).toHaveText('12', { timeout: 90_000 });
  expect(erreurs).toEqual([]);
});
