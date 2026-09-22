import type { ComparisonResult } from 'core';
// zod/mini y no zod: la misma validación, pero con funciones sueltas en vez
// de métodos encadenados, así que el bundler descarta lo que no se usa. La
// variante clásica añadía 89 kB (25 kB comprimidos) al bundle por este fichero;
// esta, unos 20 kB (6 kB comprimidos).
import * as z from 'zod/mini';
import { APP_NAME } from './appInfo';

/**
 * A comparison saved to disk, so it can be reopened after the tab is gone or
 * handed to someone else. There is no server to keep it: the file is the only
 * copy, and it is read back on the same terms as a mutation report — untrusted
 * input, validated before the dashboard touches it.
 */
export const COMPARISON_FILE_EXTENSION = '.mutadiff.json';

const FORMAT = 'mutadiff-comparison';
/** Bump when the shape of `ComparisonResult` changes in a way old files lack. */
const VERSION = 1;

const tool = z.enum(['pitest', 'stryker']);
const mutantStatus = z.enum(['killed', 'survived', 'no_coverage', 'timeout', 'error', 'ignored']);

// `z.number()` rejects NaN and Infinity, which `JSON.stringify` would have
// written as `null` anyway: every metric `core` produces is finite.
const metrics = z.object({
  total: z.number(),
  killed: z.number(),
  survived: z.number(),
  noCoverage: z.number(),
  timeout: z.number(),
  error: z.number(),
  ignored: z.number(),
  validTotal: z.number(),
  score: z.number(),
  coveredPct: z.number(),
});

// `exactOptional` and not `optional`: under `exactOptionalPropertyTypes` an
// optional field may be absent but never `undefined`, which is what the types
// in `core` declare. The annotation on `resultSchema` holds the two in step.
const mutantChange = z.object({
  line: z.number(),
  mutator: z.string(),
  description: z.exactOptional(z.string()),
  base: z.exactOptional(mutantStatus),
  head: z.exactOptional(mutantStatus),
  kind: z.enum([
    'newly-survived',
    'newly-killed',
    'newly-uncovered',
    'changed',
    'added',
    'removed',
  ]),
});

const unit = z.object({
  key: z.string(),
  kind: z.enum(['improved', 'regressed', 'unchanged', 'added', 'removed']),
  base: z.exactOptional(metrics),
  head: z.exactOptional(metrics),
  scoreDelta: z.nullable(z.number()),
  coverageDelta: z.nullable(z.number()),
  isUncovered: z.boolean(),
  mutantChanges: z.exactOptional(z.array(mutantChange)),
});

const mutator = z.object({
  mutator: z.string(),
  base: z.exactOptional(metrics),
  head: z.exactOptional(metrics),
  survivedDelta: z.nullable(z.number()),
  scoreDelta: z.nullable(z.number()),
});

const resultSchema: z.ZodMiniType<ComparisonResult> = z.object({
  tool,
  context: z.object({
    baseLabel: z.exactOptional(z.string()),
    headLabel: z.exactOptional(z.string()),
    regressionThreshold: z.number(),
    uncoveredThreshold: z.number(),
  }),
  global: z.object({
    base: metrics,
    head: metrics,
    scoreDelta: z.number(),
    coverageDelta: z.number(),
  }),
  units: z.array(unit),
  regressions: z.array(unit),
  uncovered: z.array(unit),
  added: z.array(unit),
  removed: z.array(unit),
  mutators: z.array(mutator),
});

// Checked apart from the result so a file from another app, or from a future
// format, gets told what it is instead of a list of fields it lacks.
const header = z.object({ format: z.literal(FORMAT), version: z.number() });

export function serializeComparison(result: ComparisonResult): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, result });
}

/** Throws a plain `Error` with a message for the user, like the report parsers. */
export function parseComparisonFile(text: string): ComparisonResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El fichero no es un JSON válido.');
  }

  const parsedHeader = header.safeParse(raw);
  if (!parsedHeader.success) {
    throw new Error(`El fichero no es una comparación exportada por ${APP_NAME}.`);
  }
  if (parsedHeader.data.version !== VERSION) {
    throw new Error(
      `La comparación se exportó con un formato (versión ${parsedHeader.data.version}) que esta versión de la aplicación no sabe leer.`,
    );
  }

  const parsed = resultSchema.safeParse((raw as { result?: unknown }).result);
  if (!parsed.success) {
    // Solo la primera ruta: basta para saber qué se rompió, y la lista entera de
    // un fichero corrupto puede tener miles de entradas.
    // El `!` no esconde un caso: Zod nunca falla sin al menos un issue, y un
    // `?.` con valor por defecto sería una rama que no se puede ejecutar.
    const path = parsed.error.issues[0]!.path.join('.');
    throw new Error(`La comparación exportada está incompleta o dañada (${path}).`);
  }
  return parsed.data;
}
