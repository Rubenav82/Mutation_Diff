import type { ComparisonResult, Tool, UnitCounts } from 'core';
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
        <div className="flex flex-col gap-6">
          <h1 className="eyebrow text-deep-muted!">Comparación · {tool}</h1>
          <div className="flex flex-wrap items-baseline gap-10">
            {/* Primero porque dimensiona todo lo demás, pero en cuerpo menor: es
                el tamaño de lo medido, no el veredicto. Sin color: medir más
                unidades no es ni mejor ni peor, solo distinto. */}
            <Figure
              label="Unidades analizadas"
              value={String(counts.head)}
              from={String(counts.base)}
              delta={formatSignedCount(counts.delta)}
              variant="neutral"
              trend={trendOf(counts.delta)}
              note={`${counts.covered} con cobertura · umbral ${uncoveredThreshold}%`}
              compact
            />
            <Figure
              label="Mutation score"
              value={formatPct(head.score)}
              from={formatPct(base.score)}
              delta={formatSignedPct(scoreDelta)}
              variant={trendVariant(scoreDelta)}
              trend={trendOf(scoreDelta)}
            />
            <Figure
              label="Mutantes cubiertos"
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
              is for exploring, the PDF for attaching. */}
          <div className="flex flex-wrap gap-2">
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
  label,
  value,
  from,
  delta,
  variant,
  trend,
  note,
  compact = false,
}: {
  label: string;
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
      <p className="eyebrow text-deep-muted!">{label}</p>
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
