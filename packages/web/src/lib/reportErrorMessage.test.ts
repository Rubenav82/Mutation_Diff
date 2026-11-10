import { InvalidReportError, type InvalidReportReason, type Tool } from 'core';
import { describe, expect, it } from 'vitest';
import { reportErrorMessage } from './reportErrorMessage';

function message(tool: Tool, reason: InvalidReportReason): string {
  return reportErrorMessage(new InvalidReportError(tool, reason, 'detail'), {
    tool,
    side: 'base',
    fileName: 'informe',
  });
}

describe('reportErrorMessage', () => {
  it('names the side and the file that failed', () => {
    const error = new InvalidReportError('pitest', { code: 'missing-unit' }, 'detail');

    expect(reportErrorMessage(error, { tool: 'pitest', side: 'base', fileName: 'a.xml' })).toBe(
      'La ejecución base («a.xml») no es un informe de PiTest válido: hay un <mutation> sin <mutatedClass>.',
    );
    expect(reportErrorMessage(error, { tool: 'pitest', side: 'head', fileName: 'b.xml' })).toBe(
      'La ejecución nueva («b.xml») no es un informe de PiTest válido: hay un <mutation> sin <mutatedClass>.',
    );
  });

  it('names the tool of the report', () => {
    expect(message('stryker', { code: 'missing-files' })).toBe(
      'La ejecución base («informe») no es un informe de Stryker válido: no tiene el objeto "files".',
    );
  });

  it('explains every reason in Spanish', () => {
    expect(message('pitest', { code: 'malformed-xml', line: 7 })).toBe(
      'La ejecución base («informe») no es un informe de PiTest válido: el XML está mal formado (línea 7).',
    );
    expect(message('pitest', { code: 'missing-root' })).toBe(
      'La ejecución base («informe») no es un informe de PiTest válido: no tiene el elemento raíz <mutations>. ¿Es otro XML, como el de JUnit? El que hace falta es mutations.xml.',
    );
    expect(message('stryker', { code: 'malformed-json' })).toBe(
      'La ejecución base («informe») no es un informe de Stryker válido: el JSON está mal formado.',
    );
    expect(message('stryker', { code: 'missing-schema-version' })).toBe(
      'La ejecución base («informe») no es un informe de Stryker válido: no tiene el campo "schemaVersion". ¿Es otro JSON, como el package.json? El que hace falta es mutation.json.',
    );
    expect(message('stryker', { code: 'unsupported-schema-version', schemaVersion: '3.0' })).toBe(
      'La ejecución base («informe») no es un informe de Stryker válido: usa la versión de esquema «3.0», y solo se admiten la 1.x y la 2.x.',
    );
    expect(message('stryker', { code: 'unknown-status', status: 'New', unit: 'src/a.js' })).toBe(
      'La ejecución base («informe») no es un informe de Stryker válido: el estado «New» de «src/a.js» no es uno de los que reconoce esta versión.',
    );
  });

  it('falls back to a generic message for anything the parsers did not anticipate', () => {
    // Un informe con la forma justa para pasar las comprobaciones pero no el
    // recorrido acaba en un `TypeError` del propio parser.
    expect(
      reportErrorMessage(new TypeError('x is null'), {
        tool: 'stryker',
        side: 'head',
        fileName: 'mutation.json',
      }),
    ).toBe('La ejecución nueva («mutation.json») no se pudo leer como informe de Stryker.');
  });
});
