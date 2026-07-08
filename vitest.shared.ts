/**
 * Base de configuración de Vitest compartida por todos los workspaces.
 * Cada `packages/*\/vitest.config.ts` la extiende añadiendo su `name`.
 */
export const sharedTest = {
  environment: 'node',
  include: ['src/**/*.{test,spec}.ts'],
} as const;
