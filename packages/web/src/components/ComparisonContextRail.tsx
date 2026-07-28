import { Link } from 'react-router-dom';
import type { ComparisonContext } from 'core';

interface ComparisonContextRailProps {
  context: ComparisonContext;
}

/**
 * Read-only summary of how the comparison was produced. It cannot offer to
 * recompute with other thresholds: the server never keeps the uploaded files
 * (memoryStorage), so a new run means uploading them again — hence a link back
 * to the wizard rather than a form.
 */
export function ComparisonContextRail({ context }: ComparisonContextRailProps) {
  const { baseLabel, headLabel, regressionThreshold, uncoveredThreshold } = context;

  return (
    <aside
      aria-label="Contexto de la comparación"
      className="rule flex flex-col gap-5 pt-5 lg:sticky lg:top-8"
    >
      {/* La herramienta no se repite aquí: encabeza la comparación en SummaryBand.
          El rail responde de dónde salió el resultado, no qué mide. */}
      <dl className="flex flex-col gap-5">
        {/* Comparisons stored before the label existed, and any future consumer of
            `core` that omits it, still have to render as something. */}
        <Field label="Ejecución base" value={baseLabel ?? 'Sin nombre'} muted={!baseLabel} />
        <Field label="Ejecución nueva" value={headLabel ?? 'Sin nombre'} muted={!headLabel} />
        <Field label="Umbral de retroceso" value={`${regressionThreshold}%`} />
        <Field label="Umbral sin cobertura" value={`${uncoveredThreshold}%`} />
      </dl>

      <Link
        to="/"
        className="border-2 border-line-strong px-4 py-2 text-center text-sm font-semibold text-ink transition-colors hover:bg-deep hover:text-inverse"
      >
        Nueva comparación
      </Link>
    </aside>
  );
}

function Field({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className={`mt-1 font-mono text-sm break-all ${muted ? 'text-muted italic' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  );
}
