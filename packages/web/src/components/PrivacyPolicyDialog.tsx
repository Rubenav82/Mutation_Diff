import { useEffect, useRef } from 'react';
import { APP_NAME, CONTACT_EMAIL } from '../lib/appInfo';

const TITLE_ID = 'privacy-policy-title';

interface PrivacyPolicyDialogProps {
  onClose: () => void;
}

/**
 * Cada afirmación de aquí es verificable en el código, no una promesa comercial:
 * no hay ninguna llamada de red en la comparación (`lib/comparisons.ts` llama a
 * `core` directamente), el resultado solo se guarda en `sessionStorage`
 * (`lib/comparisonStore.ts`) y el informe exportado es un único fichero sin
 * recursos externos (CA-HU-07). Si alguna de las tres cosas cambia, este texto
 * pasa a ser falso y hay que tocarlo en el mismo commit.
 *
 * No usa `<dialog>` nativo: `showModal()` no está implementado de forma fiable
 * en jsdom, así que el comportamiento modal se construye a mano — que además es
 * lo único que hace falta aquí (overlay, Escape, foco al abrir).
 */
export function PrivacyPolicyDialog({ onClose }: PrivacyPolicyDialogProps) {
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
            Política de privacidad
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

        <div className="space-y-5 px-6 py-5 text-sm leading-relaxed text-muted">
          <p>
            <span className="font-semibold text-ink">{APP_NAME}</span> es una aplicación web que
            funciona íntegramente en tu navegador. No existe ningún servidor backend: los reportes
            de mutation testing que cargues se procesan en memoria, en tu propio dispositivo, y
            nunca salen de él.
          </p>

          <section>
            <h3 className="eyebrow">No recogemos ni transmitimos</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>El contenido de los reportes: nombres de clases, rutas de ficheros y mutantes</li>
              <li>Los resultados de las comparaciones</li>
              <li>Metadatos de los archivos (nombre, tamaño o fecha de modificación)</li>
              <li>Datos personales, analítica de uso, cookies ni identificadores de sesión</li>
            </ul>
          </section>

          <section>
            <h3 className="eyebrow">Procesamiento local</h3>
            <p className="mt-2">
              Los reportes se leen directamente en el navegador mediante la API de archivos
              estándar. El parseo, la comparación y el renderizado ocurren íntegramente en tu
              dispositivo. El resultado se guarda solo en el{' '}
              <code className="font-mono">sessionStorage</code> de la pestaña, para que recargar la
              página no lo pierda; el navegador lo borra al cerrarla. Puedes comprobarlo tú mismo:
              abre las herramientas de desarrollo en la pestaña de red y verás que comparar no
              genera ni una petición.
            </p>
          </section>

          <section>
            <h3 className="eyebrow">Informe exportado</h3>
            <p className="mt-2">
              El informe HTML descargable se genera y se almacena en tu dispositivo. Es un único
              fichero autocontenido, sin CSS ni JavaScript externos, así que abrirlo tampoco envía
              nada a ningún servicio.
            </p>
          </section>

          <section>
            <h3 className="eyebrow">Contacto</h3>
            <p className="mt-2">
              Para cualquier consulta sobre privacidad o para notificar un problema, escríbenos a{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-ink underline decoration-line underline-offset-2 hover:decoration-accent"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
