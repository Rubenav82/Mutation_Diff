import type { Tool } from '../domain/types.js';

/**
 * Why a report could not be read, as data. The message stays in English for the
 * API and the CLI; anyone who shows it in another language translates from here
 * instead of matching the message text.
 */
export type InvalidReportReason =
  | { code: 'malformed-xml'; line: number }
  | { code: 'missing-root' }
  | { code: 'missing-unit' }
  | { code: 'malformed-json' }
  | { code: 'missing-schema-version' }
  | { code: 'unsupported-schema-version'; schemaVersion: string }
  | { code: 'missing-files' }
  | { code: 'unknown-status'; status: string; unit: string };

const TOOL_NAMES: Record<Tool, string> = { pitest: 'PiTest', stryker: 'Stryker' };

export class InvalidReportError extends Error {
  constructor(
    public readonly tool: Tool,
    public readonly reason: InvalidReportReason,
    detail: string,
  ) {
    super(`Invalid ${TOOL_NAMES[tool]} report: ${detail}`);
    this.name = 'InvalidReportError';
  }
}
