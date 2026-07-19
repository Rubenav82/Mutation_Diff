export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatSignedPct(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}
