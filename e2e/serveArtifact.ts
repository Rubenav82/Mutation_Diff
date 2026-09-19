import {
  ARTIFACT_ORIGIN,
  ARTIFACT_PATH,
  ARTIFACT_PORT,
  createArtifactServer,
} from './artifactServer.js';

// Punto de entrada que lanza Playwright (`webServer` en `playwright.config.ts`).
// Va aparte del módulo para que `artifact.spec.ts` pueda importar de él el
// puerto y el subpath sin abrir un puerto al hacerlo.
createArtifactServer().listen(ARTIFACT_PORT, () => {
  console.log(`Artefacto servido en ${ARTIFACT_ORIGIN}${ARTIFACT_PATH}`);
});
