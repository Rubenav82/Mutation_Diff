import { defineConfig, devices } from '@playwright/test';
import { ARTIFACT_ORIGIN, ARTIFACT_PATH } from './e2e/artifactServer.js';

const WEB_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  // Un solo worker: los tests comparten el servidor de desarrollo y su store en
  // memoria, y la suite es corta — el paralelismo solo añadiría ruido.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'on-first-retry',
  },
  // Dos objetivos, el mismo navegador (solo Chromium: esto verifica el cableado
  // wizard → dashboard → export, no el renderizado de cada motor). `dev-server`
  // es el bucle rápido de desarrollo; `artifact` ejercita el `dist` construido
  // tal como se publica, que es el hueco que dejó T-073.
  projects: [
    {
      name: 'dev-server',
      testIgnore: /artifact\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL },
    },
    {
      name: 'artifact',
      testMatch: /artifact\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: ARTIFACT_ORIGIN },
    },
  ],
  // Sin el Express: desde la Fase 4.6 la comparación entera ocurre en el
  // navegador, así que levantarlo no probaría nada — y con él delante, un fallo
  // de red pasaría desapercibido en vez de romper el test.
  webServer: [
    {
      command: 'npm run dev -w web',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // El `dist` lo construye `pretest:e2e`, no este comando: con
      // `reuseExistingServer`, un servidor ya levantado se saltaría la build y
      // la pasada mediría un artefacto viejo.
      command: 'npx tsx e2e/serveArtifact.ts',
      url: `${ARTIFACT_ORIGIN}${ARTIFACT_PATH}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
