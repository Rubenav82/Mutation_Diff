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
