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

export interface UnitComparison {
  key: string;
  kind: UnitChangeKind;
  base?: UnitMetrics;
  head?: UnitMetrics;
  scoreDelta: number | null;
  coverageDelta: number | null;
  isUncovered: boolean;
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
