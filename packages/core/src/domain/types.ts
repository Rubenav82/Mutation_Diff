export type Tool = 'pitest' | 'stryker';

export type MutantStatus = 'killed' | 'survived' | 'no_coverage' | 'timeout' | 'error' | 'ignored';

export interface Mutant {
  id: string;
  mutator: string;
  line: number;
  status: MutantStatus;
  description?: string;
}

export interface UnitResult {
  key: string;
  displayName: string;
  mutants: Mutant[];
  metrics: UnitMetrics;
}

export interface UnitMetrics {
  total: number;
  killed: number;
  survived: number;
  noCoverage: number;
  timeout: number;
  error: number;
  ignored: number;
  validTotal: number;
  score: number;
  coveredPct: number;
}

export interface NormalizedRun {
  tool: Tool;
  label?: string;
  createdAt: string;
  units: UnitResult[];
  metrics: UnitMetrics;
}

export type UnitChangeKind = 'improved' | 'regressed' | 'unchanged' | 'added' | 'removed';

/**
 * How one mutant's status moved between the two runs. Only status *changes* are
 * reported (see `UnitComparison.mutantChanges`), so there is no `unchanged` kind.
 *
 * - `newly-survived`: survives now and did not before (the actionable case).
 * - `newly-killed`: detected now (killed or timeout) and not before.
 * - `newly-uncovered`: no coverage now and had some before.
 * - `changed`: any other transition, with no actionable reading (killed ↔ timeout,
 *   anything → error/ignored).
 * - `added` / `removed`: present in one run only.
 */
export type MutantChangeKind =
  'newly-survived' | 'newly-killed' | 'newly-uncovered' | 'changed' | 'added' | 'removed';

export interface MutantComparison {
  line: number;
  mutator: string;
  /** From the new run when present there, otherwise from the base run. */
  description?: string;
  base?: MutantStatus;
  head?: MutantStatus;
  kind: MutantChangeKind;
}

export interface UnitComparison {
  key: string;
  kind: UnitChangeKind;
  base?: UnitMetrics;
  head?: UnitMetrics;
  scoreDelta: number | null;
  coverageDelta: number | null;
  isUncovered: boolean;
  /**
   * Mutants whose status differs between the runs, sorted by line. Only for units
   * present on both sides (there is nothing to pair for `added`/`removed`), and only
   * the changes: the result is what gets stored, and a full mutant list per unit would
   * not fit a session's storage budget for a large project.
   */
  mutantChanges?: MutantComparison[];
}

/**
 * How a comparison was produced. The `ComparisonResult` is the only thing stored, so
 * without this a result reopened by its id cannot say which files or thresholds made it.
 */
export interface ComparisonContext {
  baseLabel?: string;
  headLabel?: string;
  /** Effective values, with the engine defaults already applied. */
  regressionThreshold: number;
  uncoveredThreshold: number;
}

export interface ComparisonResult {
  tool: Tool;
  context: ComparisonContext;
  global: { base: UnitMetrics; head: UnitMetrics; scoreDelta: number; coverageDelta: number };
  units: UnitComparison[];
  regressions: UnitComparison[];
  uncovered: UnitComparison[];
  added: UnitComparison[];
  removed: UnitComparison[];
}
