import type { Mutant, MutantComparison, MutantChangeKind, MutantStatus } from '../domain/types.js';

// Mutant ids are sequential counters assigned by each parser (see T-011), so they mean
// nothing across runs. Line + mutator is what both PiTest and Stryker keep stable between
// executions of the same code; several mutants of one mutator on one line (e.g. two
// comparisons in one condition) are paired by order of appearance within that group.
function groupKey(mutant: Mutant): string {
  return `${mutant.line}\u0000${mutant.mutator}`;
}

function groupByKey(mutants: Mutant[]): Map<string, Mutant[]> {
  const groups = new Map<string, Mutant[]>();
  for (const mutant of mutants) {
    const key = groupKey(mutant);
    const group = groups.get(key);
    if (group) {
      group.push(mutant);
    } else {
      groups.set(key, [mutant]);
    }
  }
  return groups;
}

function isDetected(status: MutantStatus): boolean {
  return status === 'killed' || status === 'timeout';
}

// The three named kinds are mutually exclusive by the head status alone (survived,
// detected, no_coverage), so checking them in sequence cannot shadow one another.
function classify(base: MutantStatus, head: MutantStatus): MutantChangeKind {
  if (head === 'survived') return 'newly-survived';
  if (isDetected(head) && !isDetected(base)) return 'newly-killed';
  if (head === 'no_coverage') return 'newly-uncovered';
  return 'changed';
}

/**
 * Whether the mutant is alive in the new run: it survives or nothing covers it.
 * Reads the head status alone, so it holds both for a mutant that used to be
 * detected (`newly-survived`, `newly-uncovered`) and for one that is born that
 * way (`added`) — everything that means less detection than before. A `removed`
 * mutant has no head status and cannot make anything worse.
 */
export function isUndetected(change: MutantComparison): boolean {
  return change.head === 'survived' || change.head === 'no_coverage';
}

function withDescription(
  comparison: MutantComparison,
  description: string | undefined,
): MutantComparison {
  return description !== undefined ? { ...comparison, description } : comparison;
}

function compareGroup(base: Mutant[], head: Mutant[]): MutantComparison[] {
  const changes: MutantComparison[] = [];
  const paired = Math.min(base.length, head.length);

  for (let i = 0; i < paired; i++) {
    const b = base[i] as Mutant;
    const h = head[i] as Mutant;
    if (b.status === h.status) continue;
    changes.push(
      withDescription(
        {
          line: h.line,
          mutator: h.mutator,
          base: b.status,
          head: h.status,
          kind: classify(b.status, h.status),
        },
        h.description ?? b.description,
      ),
    );
  }

  for (const b of base.slice(paired)) {
    changes.push(
      withDescription(
        { line: b.line, mutator: b.mutator, base: b.status, kind: 'removed' },
        b.description,
      ),
    );
  }

  for (const h of head.slice(paired)) {
    changes.push(
      withDescription(
        { line: h.line, mutator: h.mutator, head: h.status, kind: 'added' },
        h.description,
      ),
    );
  }

  return changes;
}

/**
 * Pairs the mutants of one unit across the two runs and returns only those whose
 * status differs, sorted by line then mutator (pairing order within a group is kept).
 */
export function compareMutants(baseMutants: Mutant[], headMutants: Mutant[]): MutantComparison[] {
  const baseGroups = groupByKey(baseMutants);
  const headGroups = groupByKey(headMutants);
  const keys = new Set([...baseGroups.keys(), ...headGroups.keys()]);

  const changes: MutantComparison[] = [];
  for (const key of keys) {
    changes.push(...compareGroup(baseGroups.get(key) ?? [], headGroups.get(key) ?? []));
  }

  // Array.prototype.sort is stable, so equal (line, mutator) entries keep pairing order.
  return changes.sort((a, b) => a.line - b.line || a.mutator.localeCompare(b.mutator));
}
