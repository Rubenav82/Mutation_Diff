import { compareRuns, type ComparisonResult, type NormalizedRun, type Tool } from 'core';
import { parseComparisonFile } from './comparisonFile';
import { comparisonStore } from './comparisonStore';
import { newComparisonId } from './id';
import { parseInWorker } from './parseInWorker';
import { reportErrorMessage, type ReportErrorContext } from './reportErrorMessage';

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

/**
 * Parsing runs in a worker per side (T-113): with a large report it takes
 * seconds, and on the main thread the page froze for all of them. The label
 * the context rail displays is the file name, set inside the worker.
 */
async function parseReport(
  tool: Tool,
  side: ReportErrorContext['side'],
  file: File,
  createdAt: string,
): Promise<NormalizedRun> {
  const response = await parseInWorker({ tool, file, createdAt });
  if (!response.ok) {
    throw new ComparisonError(
      422,
      'INVALID_REPORT',
      reportErrorMessage(response.reason, { tool, side, fileName: file.name }),
    );
  }
  return response.run;
}

export async function createComparison(
  input: CreateComparisonInput,
): Promise<CreateComparisonResponse> {
  const createdAt = new Date().toISOString();
  const [base, head] = await Promise.all([
    parseReport(input.tool, 'base', input.baseFile, createdAt),
    parseReport(input.tool, 'head', input.headFile, createdAt),
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
 * Reopens a comparison saved with `serializeComparison`. It gets a new id: the
 * one it had lived in another tab, or on someone else's machine.
 */
export async function importComparison(file: File): Promise<CreateComparisonResponse> {
  const text = await file.text();
  let result: ComparisonResult;
  try {
    result = parseComparisonFile(text);
  } catch (error) {
    // Siempre un `Error` con el mensaje para el usuario: `parseComparisonFile` no
    // lanza otra cosa, y es el mismo trato que reciben los parsers de informes.
    throw new ComparisonError(422, 'INVALID_COMPARISON_FILE', (error as Error).message);
  }

  const comparisonId = newComparisonId();
  comparisonStore.save(comparisonId, result);
  return { comparisonId, result };
}

export async function getComparison(id: string): Promise<ComparisonResult> {
  const result = comparisonStore.load(id);
  if (!result) {
    throw new ComparisonError(
      404,
      'COMPARISON_NOT_FOUND',
      'Esta comparación no está disponible. Las comparaciones se guardan solo en la pestaña del navegador donde se crearon, así que un enlace no sirve en otra pestaña ni en otro equipo, y al recargar se pierden las que no cupieron. Si tienes su fichero .mutadiff.json, impórtalo desde la pantalla inicial.',
    );
  }
  return Promise.resolve(result);
}

export function survivesReload(id: string): boolean {
  return comparisonStore.survivesReload(id);
}
