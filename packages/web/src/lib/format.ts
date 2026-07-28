export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatSignedPct(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/** Missing side of an added/removed unit renders as an em dash. */
export function formatOptionalPct(value: number | undefined): string {
  return value === undefined ? '—' : formatPct(value);
}

export function formatOptionalSignedPct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : formatSignedPct(value);
}

/**
 * Direction a figure moved, which is a fact about the data. Whether that direction
 * is good or bad is a separate axis (`Variant`): more survivors is a rise and a
 * worsening at the same time, so neither can be derived from the other.
 */
export type Trend = 'up' | 'down' | 'flat';

export function trendOf(delta: number): Trend {
  if (delta === 0) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/** Same glyphs as the state tags in `UnitsTable`, so a rise reads alike everywhere. */
export const TREND_ARROW: Record<Trend, string> = { up: '▲', down: '▼', flat: '' };
