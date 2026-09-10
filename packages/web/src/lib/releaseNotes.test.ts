import { describe, expect, it } from 'vitest';
import { version } from '../../package.json';
import { RELEASE_NOTES } from './releaseNotes';

// Clave de orden semver: cada componente numérico rellenado a ancho fijo, para
// que la comparación de strings coincida con la comparación de versiones
// (sin esto, "1.10.0" ordenaría antes que "1.2.0").
const semverKey = (v: string) =>
  v
    .split('.')
    .map((part) => part.padStart(5, '0'))
    .join('.');

describe('RELEASE_NOTES', () => {
  it('opens with the packaged version: bumping one without the other goes red', () => {
    // Este test es lo que hace exigible el principio #8 de la constitución:
    // subir la versión en package.json sin anotar sus cambios aquí (o al
    // revés) rompe la suite en vez de depender de que alguien se acuerde.
    expect(RELEASE_NOTES[0]?.version).toBe(version);
  });

  it('keeps versions unique and newest-first', () => {
    const versions = RELEASE_NOTES.map((note) => note.version);

    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toEqual(
      [...versions].sort((a, b) => semverKey(b).localeCompare(semverKey(a))),
    );
  });

  it('gives every entry an ISO date and at least one user-facing change', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.date, `fecha de v${note.version}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.changes.length, `cambios de v${note.version}`).toBeGreaterThan(0);
      for (const change of note.changes) {
        expect(change.trim()).not.toBe('');
      }
    }
  });
});
