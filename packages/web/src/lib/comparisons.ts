import {
  compareRuns,
  parsePitestReport,
  parseStrykerReport,
  type ComparisonResult,
  type NormalizedRun,
  type Tool,
} from 'core';
import { comparisonStore } from './comparisonStore';
import { newComparisonId } from './id';

/**
 * A failure the user can act on, kept in the shape the pages already handle.
 *
 * `status`/`code` no longer come from an HTTP response — nothing leaves the
 * browser — but they are the same values the server produced, so the wording
 * the user sees is unchanged and the pages need no new branches.
 */
export class ComparisonError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ComparisonError';
  }
}

export interface CreateComparisonInput {
  tool: Tool;
  baseFile: File;
  headFile: File;
  regressionThreshold?: number;
  uncoveredThreshold?: number;
}

export interface CreateComparisonResponse {
  comparisonId: string;
  result: ComparisonResult;
}

const PARSERS: Record<Tool, (report: string, options: ParseOptions) => NormalizedRun> = {
  pitest: parsePitestReport,
  stryker: parseStrykerReport,
};

interface ParseOptions {
  createdAt: string;
  label?: string;
}

/**
 * `core` never reads the clock or the filesystem, so the caller supplies both
 * the timestamp and the label. The server used `file.originalname`; here the
 * equivalent is `file.name`, and it is what the context rail displays.
 */
async function parseReport(tool: Tool, file: File, createdAt: string): Promise<NormalizedRun> {
  const text = await file.text();
  try {
    return PARSERS[tool](text, { createdAt, label: file.name });
  } catch (error) {
    // The parser messages already name the tool and what is wrong with the
    // file ("Invalid PiTest report: ..."), which is exactly what the server
    // forwarded as a 422.
    throw new ComparisonError(
      422,
      'INVALID_REPORT',
      error instanceof Error ? error.message : 'Report could not be parsed',
    );
  }
}

export async function createComparison(
  input: CreateComparisonInput,
): Promise<CreateComparisonResponse> {
  const createdAt = new Date().toISOString();
  const [base, head] = await Promise.all([
    parseReport(input.tool, input.baseFile, createdAt),
    parseReport(input.tool, input.headFile, createdAt),
  ]);

  const result = compareRuns(base, head, {
    ...(input.regressionThreshold !== undefined
      ? { regressionThreshold: input.regressionThreshold }
      : {}),
    ...(input.uncoveredThreshold !== undefined
      ? { uncoveredThreshold: input.uncoveredThreshold }
      : {}),
  });

  const comparisonId = newComparisonId();
  comparisonStore.save(comparisonId, result);
  return { comparisonId, result };
}

/**
 * @deprecated Still points at the server. Replaced in T-071 by generating the
 * report from `core` and handing it to the browser as a blob.
 */
export function getComparisonReportUrl(id: string): string {
  return `/api/comparisons/${encodeURIComponent(id)}/report`;
}

export async function getComparison(id: string): Promise<ComparisonResult> {
  const result = comparisonStore.load(id);
  if (!result) {
    throw new ComparisonError(404, 'COMPARISON_NOT_FOUND', `No comparison found for id "${id}"`);
  }
  return Promise.resolve(result);
}
