import { useEffect, useRef, useState } from 'react';
import { APP_NAME, APP_VERSION, CONTACT_EMAIL, COPYRIGHT, LICENSE } from '../lib/appInfo';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';

const PANEL_ID = 'about-panel';

// `mailto` en vez de un formulario o un issue de GitHub: la app se sirve en una
// red interna y no puede contar con salida a internet ni con que quien la use
// tenga cuenta en GitHub. El asunto va prerrellenado para que los avisos lleguen
// identificados sin que nadie tenga que escribirlo.
const ISSUE_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  `${APP_NAME} — notificar un problema`,
)}`;

const ITEM_CLASS =
  'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-wash';

export function AboutMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
        aria-label="Acerca de la aplicación"
        className="flex h-8 w-8 items-center justify-center border border-line font-mono text-sm font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        ?
      </button>

      {isOpen && (
        <div
          id={PANEL_ID}
          role="region"
          aria-label="Acerca de la aplicación"
          className="rise absolute right-0 z-40 mt-2 w-72 border border-line bg-raised text-left shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="font-mono text-sm font-semibold text-ink">{APP_NAME}</p>
            <p className="mt-1 font-mono text-xs text-muted">v{APP_VERSION}</p>
            <p className="mt-2 text-xs text-muted">
              {COPYRIGHT} · {LICENSE}
            </p>
          </div>

          <a href={ISSUE_MAILTO} className={ITEM_CLASS}>
            <span aria-hidden="true" className="text-muted">
              ✉
            </span>
            Notificar un problema
          </a>

          <button
            type="button"
            onClick={() => {
              setIsPrivacyOpen(true);
              setIsOpen(false);
            }}
            className={`${ITEM_CLASS} border-t border-line`}
          >
            <span aria-hidden="true" className="text-muted">
              ⛨
            </span>
            Política de privacidad
          </button>
        </div>
      )}

      {isPrivacyOpen && <PrivacyPolicyDialog onClose={() => setIsPrivacyOpen(false)} />}
    </div>
  );
}
