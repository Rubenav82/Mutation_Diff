import type { ComparisonResult } from 'core';

export interface ComparisonStore {
  set(id: string, result: ComparisonResult): void;
  get(id: string): ComparisonResult | undefined;
}

// A comparison is meant for a single short-lived session (upload -> view -> export),
// not long-term history (that's the opt-in SQLite persistence of Fase 2, T-050).
export const DEFAULT_COMPARISON_TTL_MS = 60 * 60 * 1000;

interface Entry {
  result: ComparisonResult;
  expiresAt: number;
}

export function createComparisonStore(
  ttlMs: number,
  now: () => number = Date.now,
): ComparisonStore {
  const entries = new Map<string, Entry>();

  return {
    set(id, result) {
      entries.set(id, { result, expiresAt: now() + ttlMs });
    },
    get(id) {
      const entry = entries.get(id);
      if (!entry) {
        return undefined;
      }
      if (now() >= entry.expiresAt) {
        entries.delete(id);
        return undefined;
      }
      return entry.result;
    },
  };
}
