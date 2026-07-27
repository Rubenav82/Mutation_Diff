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

/** Regla superior de 2px: el color es del dato, no del cromo. */
const VARIANT_RULE_CLASS: Record<Variant, string> = {
  positive: 'border-gain',
  negative: 'border-loss',
  neutral: 'border-line-strong',
};

/**
 * Secondary counts. Score and coverage are not here: they lead the comparison
 * from `SummaryBand`, and repeating them would give the same figure two
 * different visual weights.
 */
export function KpiRow({ global }: { global: ComparisonResult['global'] }) {
  const { base, head } = global;

  const cards: CardSpec[] = [
    countCard('Killed', base.killed, head.killed, 'higher-better'),
    countCard('Survivors', base.survived, head.survived, 'higher-worse'),
    countCard('Sin cubrir', base.noCoverage, head.noCoverage, 'higher-worse'),
    countCard('Timeouts', base.timeout, head.timeout, 'neutral'),
  ];

  return (
    <section aria-label="Métricas globales">
      <ul className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
        {cards.map((card, index) => (
          <li
            key={card.label}
            data-variant={card.variant}
            className={`rise border-t-2 bg-raised px-4 pt-3 pb-4 ${VARIANT_RULE_CLASS[card.variant]}`}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <span className="eyebrow block">{card.label}</span>
            {/* La cifra destacada es el valor nuevo, igual que en SummaryBand. */}
            <span
              data-kpi="value"
              className="mt-1 block font-mono text-3xl font-semibold tabular-nums"
            >
              {card.headText}
            </span>
            <span className="mt-1 block font-mono text-xs tabular-nums">
              <span className={`font-semibold ${VARIANT_DELTA_CLASS[card.variant]}`}>
                {card.deltaText}
              </span>
              {/* El valor base va en su propio nodo: concatenado con el texto de
                  alrededor, una consulta por su cifra ya no lo encuentra. */}
              <span className="text-muted"> desde </span>
              <span className="text-muted">{card.baseText}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
