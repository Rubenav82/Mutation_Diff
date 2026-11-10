import { InvalidReportError, type InvalidReportReason, type Tool } from 'core';

export interface ReportErrorContext {
  tool: Tool;
  side: 'base' | 'head';
  fileName: string;
}

const TOOL_NAMES: Record<Tool, string> = { pitest: 'PiTest', stryker: 'Stryker' };

const SIDE_NAMES: Record<ReportErrorContext['side'], string> = {
  base: 'La ejecución base',
  head: 'La ejecución nueva',
};

type Explanations = {
  [Code in InvalidReportReason['code']]: (
    reason: Extract<InvalidReportReason, { code: Code }>,
  ) => string;
};

// Un mapa por código y no un `switch`: si `core` añade un motivo, esto deja de
// compilar en vez de caer en silencio al mensaje genérico.
const EXPLANATIONS: Explanations = {
  'malformed-xml': ({ line }) => `el XML está mal formado (línea ${line}).`,
  // El error más probable del primer uso: los dos son XML y salen del mismo build.
  'missing-root': () =>
    'no tiene el elemento raíz <mutations>. ¿Es otro XML, como el de JUnit? El que hace falta es mutations.xml.',
  'missing-unit': () => 'hay un <mutation> sin <mutatedClass>.',
  'malformed-json': () => 'el JSON está mal formado.',
  'missing-schema-version': () =>
    'no tiene el campo "schemaVersion". ¿Es otro JSON, como el package.json? El que hace falta es mutation.json.',
  'unsupported-schema-version': ({ schemaVersion }) =>
    `usa la versión de esquema «${schemaVersion}», y solo se admiten la 1.x y la 2.x.`,
  'missing-files': () => 'no tiene el objeto "files".',
  'unknown-status': ({ status, unit }) =>
    `el estado «${status}» de «${unit}» no es uno de los que reconoce esta versión.`,
};

/**
 * The wizard's message for a report that could not be read: which of the two
 * files, and why, in Spanish. `core` keeps its messages in English for the API
 * and the CLI, so this translates from the reason code, never from the text.
 */
export function reportErrorMessage(error: unknown, { tool, side, fileName }: ReportErrorContext) {
  const subject = `${SIDE_NAMES[side]} («${fileName}»)`;
  if (!(error instanceof InvalidReportError)) {
    return `${subject} no se pudo leer como informe de ${TOOL_NAMES[tool]}.`;
  }
  // TypeScript no correlaciona la clave con el tipo del argumento; el mapa
  // tipado de arriba es lo que garantiza que casan.
  const explain = EXPLANATIONS[error.reason.code] as (reason: InvalidReportReason) => string;
  return `${subject} no es un informe de ${TOOL_NAMES[tool]} válido: ${explain(error.reason)}`;
}
