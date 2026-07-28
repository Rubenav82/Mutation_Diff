import type { ComparisonResult, Tool } from 'core';
import { formatPct, formatSignedPct, trendOf, TREND_ARROW, type Trend } from '../lib/format';

type Variant = 'positive' | 'negative' | 'neutral';

interface SummaryBandProps {
  tool: Tool;
  global: ComparisonResult['global'];
  regressionCount: number;
  reportUrl: string;
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

function regressionSummary(count: number): string {
  if (count === 0) return 'Sin retrocesos';
  return count === 1 ? '1 retroceso' : `${count} retrocesos`;
}

/**
 * Headline of the comparison. It carries the two figures that answer "has this
 * got better or worse", so the tool name lives here rather than being repeated
 * from the context rail, which covers where the result came from.
 */
export function SummaryBand({ tool, global, regressionCount, reportUrl }: SummaryBandProps) {
  const { base, head, scoreDelta, coverageDelta } = global;

  return (
    <section className="bg-deep text-inverse">
      <div className="flex flex-wrap items-start justify-between gap-6 p-6">
        <div className="flex flex-col gap-6">
          <h1 className="eyebrow text-deep-muted!">Comparación · {tool}</h1>
          <div className="flex flex-wrap gap-10">
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
          {/* Plain anchor, not fetch+blob: the endpoint already sends
              Content-Disposition: attachment with the filename. */}
          <a
            href={reportUrl}
            download
            className="border-2 border-inverse px-4 py-2 text-sm font-semibold transition-colors hover:bg-inverse hover:text-ink"
          >
            Exportar HTML
          </a>
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
}: {
  label: string;
  value: string;
  from: string;
  delta: string;
  variant: Variant;
  trend: Trend;
}) {
  return (
    <div data-variant={variant} data-trend={trend}>
      <p className="eyebrow text-deep-muted!">{label}</p>
      <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">{value}</p>
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
    </div>
  );
}
