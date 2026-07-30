import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tool } from 'core';
import { ComparisonError, createComparison } from '../lib/comparisons';
import { ErrorMessage } from '../components/ErrorMessage';
import { FileDropZone } from '../components/FileDropZone';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ThresholdHelpPanel } from '../components/ThresholdHelpPanel';
import { ToolHelpPanel } from '../components/ToolHelpPanel';

const HELP_PANEL_ID = 'tool-help-panel';
const THRESHOLD_HELP_PANEL_ID = 'threshold-help-panel';

const EXTENSION_BY_TOOL: Record<Tool, string> = {
  pitest: '.xml',
  stryker: '.json',
};

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'pitest', label: 'PiTest' },
  { value: 'stryker', label: 'Stryker' },
];

export function NewComparisonPage() {
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool>('pitest');
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [headFile, setHeadFile] = useState<File | null>(null);
  const [regressionThreshold, setRegressionThreshold] = useState('');
  const [uncoveredThreshold, setUncoveredThreshold] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isThresholdHelpOpen, setIsThresholdHelpOpen] = useState(false);

  function handleToolChange(nextTool: Tool) {
    setTool(nextTool);
    setBaseFile(null);
    setHeadFile(null);
  }

  const canSubmit = baseFile !== null && headFile !== null && !isSubmitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!baseFile || !headFile) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const { comparisonId } = await createComparison({
        tool,
        baseFile,
        headFile,
        ...(regressionThreshold !== '' ? { regressionThreshold: Number(regressionThreshold) } : {}),
        ...(uncoveredThreshold !== '' ? { uncoveredThreshold: Number(uncoveredThreshold) } : {}),
      });
      navigate(`/comparisons/${comparisonId}`);
    } catch (err) {
      setSubmitError(err instanceof ComparisonError ? err.message : 'Error inesperado al comparar');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // Centrado dentro del contenedor de `App`, que es más ancho: alineado a la
    // izquierda dejaba el formulario pegado a un lado con la mitad derecha vacía.
    // El texto se centra con él; el panel de ayuda se exceptúa (lleva un snippet).
    <main className="rise mx-auto max-w-3xl text-center">
      <h1>Nueva comparación</h1>
      <p className="mt-2 mb-8 text-sm text-balance text-muted">
        Sube la ejecución de referencia y la nueva. Mutator Assessment Report te dice qué clases han
        perdido score, cuáles se han quedado sin tests y qué ha entrado o desaparecido.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-7">
        <fieldset>
          {/* `w-full`: la caja de un <legend> se ajusta a su contenido, así que
              centrar el texto dentro no lo mueve. Chrome lo coloca igualmente con
              el text-align heredado, Firefox no; con ancho completo da igual. */}
          <legend className="eyebrow mb-2 w-full">Herramienta</legend>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Control segmentado: radios reales, con el input oculto y el
                estado visual sobre el propio <label>. */}
            <div className="inline-flex overflow-hidden rounded-md border border-line bg-raised">
              {TOOLS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`relative cursor-pointer px-4 py-1.5 font-mono text-sm transition-colors ${
                    tool === value
                      ? 'bg-deep text-inverse'
                      : 'text-muted hover:bg-wash hover:text-ink'
                  }`}
                >
                  {/* El input cubre el segmento en vez de ser `sr-only`: así el
                      propio radio es la diana de clic, y no un <label> que se
                      interpone por encima de un input de tamaño cero. */}
                  <input
                    type="radio"
                    name="tool"
                    value={value}
                    checked={tool === value}
                    onChange={() => handleToolChange(value)}
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              aria-expanded={isHelpOpen}
              aria-controls={HELP_PANEL_ID}
              onClick={() => setIsHelpOpen((open) => !open)}
              className="flex h-7 w-7 items-center justify-center border border-line text-muted transition-colors hover:border-accent hover:text-ink"
            >
              ⓘ<span className="sr-only">Ayuda de configuración</span>
            </button>
          </div>
        </fieldset>

        {isHelpOpen && <ToolHelpPanel tool={tool} id={HELP_PANEL_ID} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <FileDropZone
            id="baseFile"
            label="Ejecución base"
            acceptedExtension={EXTENSION_BY_TOOL[tool]}
            file={baseFile}
            onFileSelected={setBaseFile}
            onClear={() => setBaseFile(null)}
            onShowHelp={() => setIsHelpOpen(true)}
          />
          <FileDropZone
            id="headFile"
            label="Ejecución nueva"
            acceptedExtension={EXTENSION_BY_TOOL[tool]}
            file={headFile}
            onFileSelected={setHeadFile}
            onClear={() => setHeadFile(null)}
            onShowHelp={() => setIsHelpOpen(true)}
          />
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="eyebrow mb-2 w-full">
            <span className="inline-flex items-center gap-2">
              Umbrales (opcional)
              <button
                type="button"
                aria-expanded={isThresholdHelpOpen}
                aria-controls={THRESHOLD_HELP_PANEL_ID}
                onClick={() => setIsThresholdHelpOpen((open) => !open)}
                className="flex h-6 w-6 items-center justify-center border border-line text-muted transition-colors hover:border-accent hover:text-ink"
              >
                ⓘ<span className="sr-only">Ayuda de umbrales</span>
              </button>
            </span>
          </legend>
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Umbral de retroceso (%)
            <input
              type="number"
              value={regressionThreshold}
              onChange={(event) => setRegressionThreshold(event.target.value)}
              placeholder="0"
              className="rounded-md border border-line bg-raised px-3 py-2 font-mono text-sm text-ink transition-colors hover:border-line-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Umbral sin cobertura (%)
            <input
              type="number"
              value={uncoveredThreshold}
              onChange={(event) => setUncoveredThreshold(event.target.value)}
              placeholder="100"
              className="rounded-md border border-line bg-raised px-3 py-2 font-mono text-sm text-ink transition-colors hover:border-line-strong"
            />
          </label>
        </fieldset>

        {isThresholdHelpOpen && <ThresholdHelpPanel id={THRESHOLD_HELP_PANEL_ID} />}

        {/* No `onRetry`: the submit button below is the way to retry. */}
        {submitError && <ErrorMessage message={submitError} />}

        {/* The progress text lives here, not in the button label: a change to a
            button's own label is not reliably announced by screen readers. */}
        {isSubmitting && <LoadingIndicator label="Comparando…" />}

        <div className="rule flex flex-wrap items-center justify-center gap-4 pt-6">
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            className="rounded-md bg-deep px-6 py-2.5 text-sm font-semibold text-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Comparar
          </button>
          {!canSubmit && !isSubmitting && (
            <span className="text-xs text-muted">Se necesitan las dos ejecuciones.</span>
          )}
        </div>
      </form>
    </main>
  );
}
