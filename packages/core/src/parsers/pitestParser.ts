import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { aggregateMetrics, calculateUnitMetrics } from '../domain/metrics.js';
import type { Mutant, MutantStatus, NormalizedRun, UnitResult } from '../domain/types.js';

export interface ParsePitestOptions {
  createdAt: string;
  label?: string;
}

const STATUS_MAP: Record<string, MutantStatus> = {
  KILLED: 'killed',
  SURVIVED: 'survived',
  NO_COVERAGE: 'no_coverage',
  TIMED_OUT: 'timeout',
  RUN_ERROR: 'error',
  MEMORY_ERROR: 'error',
  NON_VIABLE: 'error',
};

interface RawMutation {
  status?: string;
  mutatedClass?: string;
  lineNumber?: number | string;
  mutator?: string;
  description?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (_name, jpath) => jpath === 'mutations.mutation',
});

function fail(reason: string): never {
  throw new Error(`Invalid PiTest report: ${reason}`);
}

function mapStatus(rawStatus: string | undefined, mutatedClass: string): MutantStatus {
  if (!rawStatus || !(rawStatus in STATUS_MAP)) {
    fail(`unrecognized mutation status "${String(rawStatus)}" in class "${mutatedClass}"`);
  }
  return STATUS_MAP[rawStatus] as MutantStatus;
}

export function parsePitestReport(xml: string, options: ParsePitestOptions): NormalizedRun {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    fail(`malformed XML (${validation.err.msg} at line ${validation.err.line})`);
  }

  const parsed = parser.parse(xml) as { mutations?: string | { mutation?: RawMutation[] } };
  if (!('mutations' in parsed)) {
    fail('missing <mutations> root element');
  }

  // An empty or self-closed <mutations/> root parses to '' rather than an object.
  const rawMutations =
    typeof parsed.mutations === 'string' ? [] : (parsed.mutations?.mutation ?? []);
  const mutantsByClass = new Map<string, Mutant[]>();
  let nextId = 0;

  for (const raw of rawMutations) {
    const mutatedClass = raw.mutatedClass;
    if (!mutatedClass) {
      fail('a <mutation> is missing <mutatedClass>');
    }
    const mutant: Mutant = {
      id: String(nextId++),
      mutator: raw.mutator ?? '',
      line: Number(raw.lineNumber ?? 0),
      status: mapStatus(raw.status, mutatedClass),
      ...(raw.description !== undefined ? { description: raw.description } : {}),
    };
    const existing = mutantsByClass.get(mutatedClass);
    if (existing) {
      existing.push(mutant);
    } else {
      mutantsByClass.set(mutatedClass, [mutant]);
    }
  }

  const units: UnitResult[] = Array.from(mutantsByClass.entries()).map(([key, mutants]) => ({
    key,
    displayName: key,
    mutants,
    metrics: calculateUnitMetrics(mutants),
  }));

  return {
    tool: 'pitest',
    createdAt: options.createdAt,
    ...(options.label !== undefined ? { label: options.label } : {}),
    units,
    metrics: aggregateMetrics(units),
  };
}
