import { defineConfig, devices } from '@playwright/test';

// Les tests tournent sur le vrai build (npm run build), servi par vite preview :
// on vérifie ainsi ce qui sera réellement déposé sur le site.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
