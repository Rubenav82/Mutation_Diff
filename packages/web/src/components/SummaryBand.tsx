import { KPI_GLOSSARY } from 'core';
import type { ComparisonResult, KpiGlossaryEntry, Tool, UnitCounts } from 'core';
import { KpiTerm } from './KpiTerm';
import {
  formatPct,
  formatSignedCount,
  formatSignedPct,
  trendOf,
  TREND_ARROW,
  type Trend,
} from '../lib/format';

type Variant = 'positive' | 'negative' | 'neutral';

interface SummaryBandProps {
  tool: Tool;
  global: ComparisonResult['global'];
  counts: UnitCounts;
  /** Effective threshold behind `counts.covered`, spelled out next to it. */
  uncoveredThreshold: number;
  regressionCount: number;
  onExport: () => void;
  onExportPdf: () => void;
}

/** Sobre la banda oscura, no los tokens del tema claro: ahí dan 1.9:1. */
const VARIANT_CLASS: Record<Variant, string> = {
  positive: 'text-gain-inverse',
  negative: 'text-loss-inverse',
  neutral: 'text-deep-muted',
};

function trendVariant(delta: number): Variant {
  if (delta === 0) return 'neutral';
  return delta > 0 ? 'positive' : 'negative';
}

const EXPORT_BUTTON_CLASS =
  'border-2 border-inverse px-4 py-2 text-sm font-semibold transition-colors hover:bg-inverse hover:text-ink';

function regressionSummary(count: number): string {
  if (count === 0) return 'Sin retrocesos';
  return count === 1 ? '1 retroceso' : `${count} retrocesos`;
}

/**
 * Headline of the comparison. It carries the two figures that answer "has this
 * got better or worse", so the tool name lives here rather than being repeated
 * from the context rail, which covers where the result came from.
 */
export function SummaryBand({
  tool,
  global,
  counts,
  uncoveredThreshold,
  regressionCount,
  onExport,
  onExportPdf,
}: SummaryBandProps) {
  const { base, head, scoreDelta, coverageDelta } = global;

  return (
    <section className="bg-deep text-inverse">
      <div className="flex flex-wrap items-start justify-between gap-6 p-6">
        {/* `min-w-0 flex-1`: sin esto la columna de cifras se dimensiona por su
            contenido y, al pasar de dos a cuatro, empuja los botones a la línea
            siguiente. Encogiendo, las cifras se reparten entre ellas y los botones
            se quedan a la derecha hasta que la pantalla ya no da para las dos. */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h1 className="eyebrow text-deep-muted! text-center">Comparación · {tool}</h1>
          <div className="flex flex-wrap items-baseline gap-10 text-center">
            {/* Primero porque dimensionan todo lo demás, pero en cuerpo menor: son
                el tamaño de lo medido, no el veredicto. Los dos recuentos van con
                color: analizar más clases es mejor —la ejecución nueva llega a más
                sitio, y una caída suele delatar una ejecución incompleta—, y otro
                tanto para las que tienen cobertura. */}
            <Figure
              entry={KPI_GLOSSARY.analyzedClasses}
              value={String(counts.head.total)}
              from={String(counts.base.total)}
              delta={formatSignedCount(counts.totalDelta)}
              variant={trendVariant(counts.totalDelta)}
              trend={trendOf(counts.totalDelta)}
              compact
            />
            <Figure
              entry={KPI_GLOSSARY.coveredClasses}
              value={String(counts.head.covered)}
              from={String(counts.base.covered)}
              delta={formatSignedCount(counts.coveredDelta)}
              variant={trendVariant(counts.coveredDelta)}
              trend={trendOf(counts.coveredDelta)}
              note={`umbral ${uncoveredThreshold}%`}
              compact
            />
            <Figure
              entry={KPI_GLOSSARY.score}
              value={formatPct(head.score)}
              from={formatPct(base.score)}
              delta={formatSignedPct(scoreDelta)}
              variant={trendVariant(scoreDelta)}
              trend={trendOf(scoreDelta)}
            />
            <Figure
              entry={KPI_GLOSSARY.coveredMutants}
              value={formatPct(head.coveredPct)}
              from={formatPct(base.coveredPct)}
              delta={formatSignedPct(coverageDelta)}
              variant={trendVariant(coverageDelta)}
              trend={trendOf(coverageDelta)}
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-3">
          {/* Buttons, not anchors: there is no server left to link to, and
              building the report is an action rather than a navigation. Both
              formats are offered because they answer different needs — the HTML
              is for exploring, the PDF for attaching.

              Stacked rather than side by side: two of them in a row take about a
              third of the band, which is what pushed the whole block below the
              figures once there were four of them. */}
          <div className="flex flex-col gap-2">
            <button type="button" onClick={onExport} className={EXPORT_BUTTON_CLASS}>
              Exportar HTML
            </button>
            <button type="button" onClick={onExportPdf} className={EXPORT_BUTTON_CLASS}>
              Exportar PDF
            </button>
          </div>
          <span
            className={`font-mono text-xs ${regressionCount > 0 ? 'text-loss-inverse' : 'text-deep-muted'}`}
          >
            {regressionSummary(regressionCount)}
          </span>
        </div>
      </div>
    </section>
  );
}

function Figure({
  entry,
  value,
  from,
  delta,
  variant,
  trend,
  note,
  compact = false,
}: {
  /** Label plus glossary definition: every figure explains itself (T-088). */
  entry: KpiGlossaryEntry;
  value: string;
  from: string;
  delta: string;
  variant: Variant;
  trend: Trend;
  /** Extra line under the delta, for a figure that carries a second number. */
  note?: string;
  /** Renders the value one step down, for context rather than a verdict. */
  compact?: boolean;
}) {
  return (
    <div data-variant={variant} data-trend={trend}>
      <p className="eyebrow text-deep-muted!">
        <KpiTerm entry={entry} />
      </p>
      <p
        className={`mt-1 font-mono font-semibold tabular-nums ${compact ? 'text-3xl' : 'text-4xl'}`}
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-xs tabular-nums">
        <span className="text-deep-muted">{from}</span>
        <span aria-hidden="true" className="text-deep-muted">
          {' → '}
        </span>
        {/* Decorativa: el delta con signo ya dice la dirección, y va en su propio
            nodo para que una consulta por la cifra siga encontrándola. */}
        {trend !== 'flat' && (
          <span aria-hidden="true" className={`mr-1 ${VARIANT_CLASS[variant]}`}>
            {TREND_ARROW[trend]}
          </span>
        )}
        <span className={VARIANT_CLASS[variant]}>{delta}</span>
      </p>
      {note !== undefined && (
        <p className="mt-1 font-mono text-xs text-deep-muted tabular-nums">{note}</p>
      )}
    </div>
  );
}
