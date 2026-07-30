import { describe, expect, it } from 'vitest';
import { splitUnitKey } from './format';

describe('splitUnitKey', () => {
  it('splits a PiTest class at its last package separator', () => {
    expect(
      splitUnitKey('es.example.otee.ordenperiodica.utilidades.UtilOrdenPeriodica', 'pitest'),
    ).toEqual({
      // El separador va con el nombre: el prefijo se recorta por la izquierda y
      // un punto final se le escaparía al otro extremo (bidi).
      prefix: 'es.example.otee.ordenperiodica.utilidades',
      name: '.UtilOrdenPeriodica',
    });
  });

  it('leaves a PiTest class in the default package whole', () => {
    expect(splitUnitKey('Calculator', 'pitest')).toEqual({ prefix: '', name: 'Calculator' });
  });

  it('splits a Stryker path at its last directory separator', () => {
    expect(splitUnitKey('src/billing/util/currencyFormatter.js', 'stryker')).toEqual({
      prefix: 'src/billing/util',
      name: '/currencyFormatter.js',
    });
  });

  it('leaves a Stryker file at the root whole, extension included', () => {
    // El separador lo decide la herramienta y no una heurística: con el punto,
    // `calculator.js` se partiría en «calculator.» y «js».
    expect(splitUnitKey('calculator.js', 'stryker')).toEqual({
      prefix: '',
      name: 'calculator.js',
    });
  });
});
