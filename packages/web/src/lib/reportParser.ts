import {
  InvalidReportError,
  parsePitestReport,
  parseStrykerReport,
  type InvalidReportReason,
  type NormalizedRun,
  type Tool,
} from 'core';

export interface ParseRequest {
  tool: Tool;
  file: File;
  createdAt: string;
}

/**
 * What crosses back from the worker. A failure travels as its reason and not
 * as the error: structured cloning keeps only `name` and `message`, so an
 * `InvalidReportError` would arrive without the `reason` the wizard translates.
 * `null` is a failure the parsers did not anticipate.
 */
export type ParseResponse =
  { ok: true; run: NormalizedRun } | { ok: false; reason: InvalidReportReason | null };

const PARSERS: Record<Tool, typeof parsePitestReport> = {
  pitest: parsePitestReport,
  stryker: parseStrykerReport,
};

/**
 * Reads and parses one report. It runs inside the worker, so reading the file
 * leaves the main thread too; `core` never reads the clock, so the caller sends
 * the timestamp, and the label is the file name the context rail displays.
 */
export async function parseReportFile({
  tool,
  file,
  createdAt,
}: ParseRequest): Promise<ParseResponse> {
  try {
    const text = await file.text();
    return { ok: true, run: PARSERS[tool](text, { createdAt, label: file.name }) };
  } catch (error) {
    return { ok: false, reason: error instanceof InvalidReportError ? error.reason : null };
  }
}
