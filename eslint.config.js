import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/.stryker-tmp/**',
      '**/reports/**',
      'test-results/**',
      'playwright-report/**',
      // Material de diseño de entrada: código ajeno al proyecto, no se lintea.
      'design-input/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // `e2e` corre bajo Node (fs, Buffer, import.meta), no en el navegador:
    // el código de página vive dentro de los locators de Playwright.
    files: ['packages/core/**/*.ts', 'packages/server/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  prettier,
);
