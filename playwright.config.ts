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
  // `npm run dev` levanta server (3000) y web (5173) vía concurrently. Se espera
  // por Vite porque es el más lento de los dos en arrancar.
  webServer: {
    command: 'npm run dev',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
