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
  positive: 'text-gain',
  negative: 'text-loss',
  neutral: 'text-muted',
};

/** Filete superior de la tarjeta: el color del dato, no del cromo. */
const VARIANT_RULE_CLASS: Record<Variant, string> = {
  positive: 'bg-gain',
  negative: 'bg-loss',
  neutral: 'bg-line',
};

/**
 * Secondary counts. Score and coverage are not here: they lead the comparison
 * from `SummaryBand`, and repeating them would give the same figure two
 * different visual weights.
 */
export function GlobalSummaryCards({ global }: { global: ComparisonResult['global'] }) {
  const { base, head } = global;

  const cards: CardSpec[] = [
    countCard('Killed', base.killed, head.killed, 'higher-better'),
    countCard('Survivors', base.survived, head.survived, 'higher-worse'),
    countCard('Sin cubrir', base.noCoverage, head.noCoverage, 'higher-worse'),
    countCard('Timeouts', base.timeout, head.timeout, 'neutral'),
  ];

  return (
    <section aria-label="Métricas globales">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card, index) => (
          <li
            key={card.label}
            data-variant={card.variant}
            className="rise overflow-hidden rounded-lg border border-line bg-raised"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <span className={`block h-0.5 ${VARIANT_RULE_CLASS[card.variant]}`} />
            <span className="block px-3 pt-3">
              <span className="eyebrow">{card.label}</span>
            </span>
            <span
              className={`block px-3 pt-1 font-mono text-xl font-semibold tabular-nums ${VARIANT_DELTA_CLASS[card.variant]}`}
            >
              {card.deltaText}
            </span>
            <span className="block px-3 pb-3 font-mono text-xs text-muted tabular-nums">
              <span>{card.baseText}</span>
              <span aria-hidden="true"> → </span>
              <span>{card.headText}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
