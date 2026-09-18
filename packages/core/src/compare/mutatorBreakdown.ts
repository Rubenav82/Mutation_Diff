import type { Mutant, MutatorComparison, NormalizedRun, UnitMetrics } from '../domain/types.js';
import { calculateUnitMetrics } from '../domain/metrics.js';

export interface MutatorBreakdownEntry {
  mutator: string;
  metrics: UnitMetrics;
}

/**
 * Same metrics as a unit, but grouped by mutator across the whole run: what a
 * mutator's kill rate is, and how many of its mutants survive. Reuses
 * `calculateUnitMetrics` so there is a single set of formulas.
 */
export function mutatorBreakdown(run: NormalizedRun): MutatorBreakdownEntry[] {
  const groups = new Map<string, Mutant[]>();
  for (const unit of run.units) {
    for (const mutant of unit.mutants) {
      const group = groups.get(mutant.mutator);
      if (group) {
        group.push(mutant);
      } else {
        groups.set(mutant.mutator, [mutant]);
      }
    }
  }
  return Array.from(groups, ([mutator, mutants]) => ({
    mutator,
    metrics: calculateUnitMetrics(mutants),
  })).sort((a, b) => a.mutator.localeCompare(b.mutator));
}

/**
 * Per-mutator comparison of the two runs, most survivors in the new run first
 * (a mutator absent from it goes last), then by name. That order answers the
 * question the breakdown is for: which mutators are producing the survivors.
 */
export function compareMutatorBreakdown(
  base: NormalizedRun,
  head: NormalizedRun,
): MutatorComparison[] {
  const baseByMutator = new Map(mutatorBreakdown(base).map((e) => [e.mutator, e.metrics]));
  const headByMutator = new Map(mutatorBreakdown(head).map((e) => [e.mutator, e.metrics]));
  const mutators = new Set([...baseByMutator.keys(), ...headByMutator.keys()]);

  return Array.from(mutators, (mutator): MutatorComparison => {
    const baseMetrics = baseByMutator.get(mutator);
    const headMetrics = headByMutator.get(mutator);
    const both = baseMetrics !== undefined && headMetrics !== undefined;
    return {
      mutator,
      ...(baseMetrics !== undefined ? { base: baseMetrics } : {}),
      ...(headMetrics !== undefined ? { head: headMetrics } : {}),
      survivedDelta: both ? headMetrics.survived - baseMetrics.survived : null,
      scoreDelta: both ? headMetrics.score - baseMetrics.score : null,
    };
  }).sort(
    (a, b) =>
      (b.head?.survived ?? -1) - (a.head?.survived ?? -1) || a.mutator.localeCompare(b.mutator),
  );
}
