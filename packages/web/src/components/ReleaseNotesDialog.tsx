import { useEffect, useRef } from 'react';
import { RELEASE_NOTES } from '../lib/releaseNotes';

const TITLE_ID = 'release-notes-title';

interface ReleaseNotesDialogProps {
  onClose: () => void;
}

/**
 * Historial de cambios de la aplicación, entrada por versión. El contenido
 * sale íntegro de `RELEASE_NOTES`; aquí solo vive la presentación.
 *
 * Mismo patrón modal a mano que `PrivacyPolicyDialog` (T-076/T-077): overlay +
 * `role="dialog"` + Escape + foco al botón de cerrar al montar — `<dialog>`
 * nativo sigue descartado porque `showModal()` no es fiable en jsdom.
 */
export function ReleaseNotesDialog({ onClose }: ReleaseNotesDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-8"
      onClick={(event) => {
        // Solo el fondo cierra; un clic dentro del panel burbujea hasta aquí.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="rise w-full max-w-2xl border border-line bg-raised"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <h2 id={TITLE_ID} className="text-ink">
            Notas de versión
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 border border-line px-2 py-0.5 font-mono text-sm text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-5 text-sm leading-relaxed text-muted">
          {RELEASE_NOTES.map((note) => (
            <section key={note.version}>
              {/* La fecha va en su propio nodo, fuera del heading: el nombre
                  accesible de la entrada es solo la versión. */}
              <div className="flex items-baseline gap-3">
                <h3 className="font-mono text-sm font-semibold text-ink">v{note.version}</h3>
                <p className="font-mono text-xs">{note.date}</p>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {note.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
