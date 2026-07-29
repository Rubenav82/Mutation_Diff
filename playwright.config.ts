import { defineConfig, devices } from '@playwright/test';

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
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  // Solo Chromium: estos tests verifican el cableado wizard → API → dashboard →
  // export, no el renderizado específico de cada motor.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Solo el front: desde la Fase 4.6 la comparación entera ocurre en el
  // navegador, así que levantar también el Express no probaría nada — y con él
  // delante, un fallo de red pasaría desapercibido en vez de romper el test.
  webServer: {
    command: 'npm run dev -w web',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
