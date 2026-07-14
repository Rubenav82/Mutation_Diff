import { aggregateMetrics, calculateUnitMetrics } from '../domain/metrics.js';
import type { Mutant, MutantStatus, NormalizedRun, UnitResult } from '../domain/types.js';

export interface ParseStrykerOptions {
  createdAt: string;
  label?: string;
}

const STATUS_MAP: Record<string, MutantStatus> = {
  Killed: 'killed',
  Survived: 'survived',
  NoCoverage: 'no_coverage',
  Timeout: 'timeout',
  CompileError: 'error',
  RuntimeError: 'error',
  Ignored: 'ignored',
};

const SUPPORTED_SCHEMA_MAJOR_VERSIONS = new Set(['1', '2']);

interface RawMutant {
  id?: string;
  mutatorName?: string;
  replacement?: string;
  status?: string;
  location?: { start?: { line?: number } };
}

interface RawFile {
  mutants?: RawMutant[];
}

interface RawReport {
  schemaVersion?: unknown;
  files?: Record<string, RawFile>;
}

function fail(reason: string): never {
  throw new Error(`Invalid Stryker report: ${reason}`);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function mapStatus(rawStatus: string | undefined, filePath: string): MutantStatus {
  if (!rawStatus || !(rawStatus in STATUS_MAP)) {
    fail(`unrecognized mutant status "${String(rawStatus)}" in file "${filePath}"`);
  }
  return STATUS_MAP[rawStatus] as MutantStatus;
}

function assertSupportedSchemaVersion(schemaVersion: unknown): void {
  if (typeof schemaVersion !== 'string') {
    fail('missing or non-string "schemaVersion"');
  }
  const major = schemaVersion.split('.')[0];
  if (!major || !SUPPORTED_SCHEMA_MAJOR_VERSIONS.has(major)) {
    fail(`unsupported schemaVersion "${schemaVersion}" (only 1.x and 2.x are supported)`);
  }
}

export function parseStrykerReport(json: string, options: ParseStrykerOptions): NormalizedRun {
  let parsed: RawReport;
  try {
    parsed = JSON.parse(json) as RawReport;
  } catch {
    fail('malformed JSON');
  }

  assertSupportedSchemaVersion(parsed.schemaVersion);

  if (!parsed.files || typeof parsed.files !== 'object') {
    fail('missing "files" object');
  }

  const units: UnitResult[] = Object.entries(parsed.files).map(([rawPath, file]) => {
    const key = normalizePath(rawPath);
    const mutants: Mutant[] = (file.mutants ?? []).map((raw) => ({
      id: raw.id ?? '',
      mutator: raw.mutatorName ?? '',
      line: raw.location?.start?.line ?? 0,
      status: mapStatus(raw.status, key),
      ...(raw.replacement !== undefined ? { description: raw.replacement } : {}),
    }));

    return {
      key,
      displayName: key,
      mutants,
      metrics: calculateUnitMetrics(mutants),
    };
  });

  return {
    tool: 'stryker',
    createdAt: options.createdAt,
    ...(options.label !== undefined ? { label: options.label } : {}),
    units,
    metrics: aggregateMetrics(units),
  };
}
