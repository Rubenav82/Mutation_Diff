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

export interface ComparisonResult {
  tool: Tool;
  global: { base: UnitMetrics; head: UnitMetrics; scoreDelta: number; coverageDelta: number };
  units: UnitComparison[];
  regressions: UnitComparison[];
  uncovered: UnitComparison[];
  added: UnitComparison[];
  removed: UnitComparison[];
}
