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

function statusChange(b: Mutant, h: Mutant): MutantComparison {
  return withDescription(
    {
      line: h.line,
      mutator: h.mutator,
      base: b.status,
      head: h.status,
      kind: classify(b.status, h.status),
    },
    h.description ?? b.description,
  );
}

function removed(b: Mutant): MutantComparison {
  return withDescription(
    { line: b.line, mutator: b.mutator, base: b.status, kind: 'removed' },
    b.description,
  );
}

function added(h: Mutant): MutantComparison {
  return withDescription(
    { line: h.line, mutator: h.mutator, head: h.status, kind: 'added' },
    h.description,
  );
}

// Records a matched pair; only a status difference is a change worth reporting.
function pair(b: Mutant, h: Mutant, changes: MutantComparison[]): void {
  if (b.status !== h.status) changes.push(statusChange(b, h));
}

function compareGroup(base: Mutant[], head: Mutant[], changes: MutantComparison[]): void {
  const paired = Math.min(base.length, head.length);
  for (let i = 0; i < paired; i++) {
    pair(base[i] as Mutant, head[i] as Mutant, changes);
  }
  changes.push(...base.slice(paired).map(removed), ...head.slice(paired).map(added));
}

function alignKey(mutant: Mutant): string {
  return `${mutant.mutator}\u0000${mutant.description}`;
}

// Above this many cells the alignment table is not built and that stretch is left
// to the line + mutator pass: 1000 × 1000 mutants in the changed middle of one unit
// is already extreme, and the table (4 bytes per cell) would otherwise be unbounded.
const MAX_ALIGNMENT_CELLS = 1_000_000;

interface Unpaired {
  base: Mutant[];
  head: Mutant[];
}

// Longest common subsequence by alignKey, the way a text diff aligns lines. On a tie
// the base mutant is dropped first, as a diff lists deletions before insertions.
function alignMiddle(base: Mutant[], head: Mutant[], changes: MutantComparison[]): Unpaired {
  if (base.length * head.length > MAX_ALIGNMENT_CELLS) return { base, head };

  const width = head.length + 1;
  // lcs[i * width + j]: length of the longest common subsequence of base[i..] and head[j..].
  const lcs = new Uint32Array((base.length + 1) * width);
  for (let i = base.length - 1; i >= 0; i--) {
    for (let j = head.length - 1; j >= 0; j--) {
      lcs[i * width + j] =
        alignKey(base[i] as Mutant) === alignKey(head[j] as Mutant)
          ? (lcs[(i + 1) * width + j + 1] as number) + 1
          : Math.max(lcs[(i + 1) * width + j] as number, lcs[i * width + j + 1] as number);
    }
  }

  const unpaired: Unpaired = { base: [], head: [] };
  let i = 0;
  let j = 0;
  while (i < base.length && j < head.length) {
    const b = base[i] as Mutant;
    const h = head[j] as Mutant;
    if (alignKey(b) === alignKey(h)) {
      pair(b, h, changes);
      i++;
      j++;
    } else if ((lcs[(i + 1) * width + j] as number) >= (lcs[i * width + j + 1] as number)) {
      unpaired.base.push(b);
      i++;
    } else {
      unpaired.head.push(h);
      j++;
    }
  }
  unpaired.base.push(...base.slice(i));
  unpaired.head.push(...head.slice(j));
  return unpaired;
}

// The common prefix and suffix pair directly, so the table only covers the stretch
// that actually changed: inserting lines in the middle of a file leaves a short one.
function align(base: Mutant[], head: Mutant[], changes: MutantComparison[]): Unpaired {
  let prefix = 0;
  while (
    prefix < base.length &&
    prefix < head.length &&
    alignKey(base[prefix] as Mutant) === alignKey(head[prefix] as Mutant)
  ) {
    pair(base[prefix] as Mutant, head[prefix] as Mutant, changes);
    prefix++;
  }
  let baseEnd = base.length;
  let headEnd = head.length;
  while (
    baseEnd > prefix &&
    headEnd > prefix &&
    alignKey(base[baseEnd - 1] as Mutant) === alignKey(head[headEnd - 1] as Mutant)
  ) {
    baseEnd--;
    headEnd--;
    pair(base[baseEnd] as Mutant, head[headEnd] as Mutant, changes);
  }
  return alignMiddle(base.slice(prefix, baseEnd), head.slice(prefix, headEnd), changes);
}

// Within a line Stryker does not keep the same order from one run to the next (seen
// in the line-shift fixture), so each line is sorted by alignKey to make it canonical.
// Array.prototype.sort is stable: identical mutants keep report order, which is the
// pairing order of T-090.
function inLineOrder(mutants: Mutant[]): Mutant[] {
  return [...mutants].sort((a, b) => {
    const keyA = alignKey(a);
    const keyB = alignKey(b);
    return a.line - b.line || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0);
  });
}

/**
 * Pairs the mutants of one unit across the two runs and returns only those whose
 * status differs, sorted by line then mutator (pairing order within a group is kept).
 *
 * First both runs are aligned in line order by (mutator, description), as a text
 * diff aligns lines: inserted or deleted lines shift every mutant below them, and
 * pairing by line would see each moved mutant as removed + added (T-110). What that
 * leaves unpaired is then paired by line + mutator (T-090), which catches a mutant
 * whose description changed in place. A mutant that was reordered rather than
 * shifted cannot be aligned without crossing another and stays removed + added:
 * reporting less than what changed is preferable to inventing a status change.
 */
export function compareMutants(baseMutants: Mutant[], headMutants: Mutant[]): MutantComparison[] {
  const changes: MutantComparison[] = [];
  const unpaired = align(inLineOrder(baseMutants), inLineOrder(headMutants), changes);

  const baseGroups = groupByKey(unpaired.base);
  const headGroups = groupByKey(unpaired.head);
  for (const key of new Set([...baseGroups.keys(), ...headGroups.keys()])) {
    compareGroup(baseGroups.get(key) ?? [], headGroups.get(key) ?? [], changes);
  }

  // Array.prototype.sort is stable, so equal (line, mutator) entries keep pairing order.
  return changes.sort((a, b) => a.line - b.line || a.mutator.localeCompare(b.mutator));
}
