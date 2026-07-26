import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { sharedTest } from '../../vitest.shared.js';

export default defineConfig({
  plugins: [react()],
  test: {
    ...sharedTest,
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
