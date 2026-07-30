import type { Tool } from 'core';

/**
 * Splits a unit key into the part that repeats row after row (package or
 * directory) and the part that identifies it. Lets a table clip only the prefix
 * when there is no room, keeping the name that tells one row from another.
 *
 * The separator comes from the tool, not from a guess: PiTest keys are class
 * names and Stryker keys are file paths (already normalised to `/` by the
 * parser). Falling back to the last dot would split `calculator.js` into
 * `calculator.` and `js`.
 *
 * The separator goes with the `name`, not at the end of the `prefix`: the prefix
 * is clipped from the left (`direction: rtl`) and a trailing dot is a neutral
 * character, which the bidi algorithm moves to the other end — the class would
 * render glued to its package with no separator at all.
 */
export function splitUnitKey(key: string, tool: Tool): { prefix: string; name: string } {
  const separator = tool === 'stryker' ? '/' : '.';
  const cut = key.lastIndexOf(separator);
  if (cut === -1) return { prefix: '', name: key };
  return { prefix: key.slice(0, cut), name: key.slice(cut) };
}

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
