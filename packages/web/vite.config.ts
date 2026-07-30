import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { singleFile } from './vite-plugin-single-file';

export default defineConfig({
  // Relative asset URLs so the same build works served from the domain root or
  // from a subpath, without knowing which at build time. Redundant now that
  // everything is inlined, but it keeps the build correct if something ever
  // escapes inlining.
  base: './',
  build: {
    // Nothing is fetched separately, so a preload hint would point at a file
    // that no longer exists.
    modulePreload: false,
    // Any future image or font becomes a data URI instead of a sibling file,
    // which is what keeps the output a single file. The `singleFile` plugin
    // fails the build if something slips through anyway.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  },
  plugins: [react(), tailwindcss(), singleFile()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
