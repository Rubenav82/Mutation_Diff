import type { ComparisonResult } from 'core';

type Polarity = 'higher-better' | 'higher-worse' | 'neutral';
type Variant = 'positive' | 'negative' | 'neutral';

interface CardSpec {
  label: string;
  baseText: string;
  headText: string;
  deltaText: string;
  variant: Variant;
}

function trendVariant(delta: number, polarity: Polarity): Variant {
  if (delta === 0 || polarity === 'neutral') return 'neutral';
  const isGood = polarity === 'higher-better' ? delta > 0 : delta < 0;
  return isGood ? 'positive' : 'negative';
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatPctDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatCountDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function countCard(label: string, base: number, head: number, polarity: Polarity): CardSpec {
  const delta = head - base;
  return {
    label,
    baseText: String(base),
    headText: String(head),
    deltaText: formatCountDelta(delta),
    variant: trendVariant(delta, polarity),
  };
}

const VARIANT_DELTA_CLASS: Record<Variant, string> = {
  positive: 'text-green-700 dark:text-green-400',
  negative: 'text-red-700 dark:text-red-400',
  neutral: 'text-gray-500 dark:text-gray-400',
};

export function GlobalSummaryCards({ global }: { global: ComparisonResult['global'] }) {
  const { base, head, scoreDelta, coverageDelta } = global;

  const cards: CardSpec[] = [
    {
      label: 'Mutation score',
      baseText: formatPct(base.score),
      headText: formatPct(head.score),
      deltaText: formatPctDelta(scoreDelta),
      variant: trendVariant(scoreDelta, 'higher-better'),
    },
    {
      label: 'Cobertura',
      baseText: formatPct(base.coveredPct),
      headText: formatPct(head.coveredPct),
      deltaText: formatPctDelta(coverageDelta),
      variant: trendVariant(coverageDelta, 'higher-better'),
    },
    countCard('Killed', base.killed, head.killed, 'higher-better'),
    countCard('Supervivientes', base.survived, head.survived, 'higher-worse'),
    countCard('Sin cobertura', base.noCoverage, head.noCoverage, 'higher-worse'),
    countCard('Timeouts', base.timeout, head.timeout, 'neutral'),
  ];

  return (
    <section aria-label="Métricas globales">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <li
            key={card.label}
            data-variant={card.variant}
            className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
          >
            <span className="block text-xs text-gray-500 dark:text-gray-400">{card.label}</span>
            <span className="block text-sm text-gray-600 dark:text-gray-300">
              <span>{card.baseText}</span>
              <span aria-hidden="true"> → </span>
              <span>{card.headText}</span>
            </span>
            <span className={`block text-lg font-semibold ${VARIANT_DELTA_CLASS[card.variant]}`}>
              {card.deltaText}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
