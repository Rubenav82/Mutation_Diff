import { describe, expect, it } from 'vitest';
import {
  formatOptionalPct,
  formatOptionalSignedPct,
  formatPct,
  formatSignedCount,
  formatSignedPct,
  splitUnitKey,
  TREND_ARROW,
  trendOf,
  trendVariant,
} from './format';

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

describe('percent formatting', () => {
  it('rounds to one decimal with a percent sign', () => {
    expect(formatPct(66.666)).toBe('66.7%');
  });

  it('signs a positive delta, leaves the minus to the number, and never signs zero', () => {
    expect(formatSignedPct(4.8)).toBe('+4.8%');
    expect(formatSignedPct(-4.8)).toBe('-4.8%');
    // Un cero con «+» delante diría que subió.
    expect(formatSignedPct(0)).toBe('0.0%');
  });

  it('renders a missing side as an em dash', () => {
    expect(formatOptionalPct(undefined)).toBe('—');
    expect(formatOptionalPct(50)).toBe('50.0%');
    expect(formatOptionalSignedPct(undefined)).toBe('—');
    expect(formatOptionalSignedPct(null)).toBe('—');
    expect(formatOptionalSignedPct(-2)).toBe('-2.0%');
  });
});

describe('formatSignedCount', () => {
  it('signs every value, zero included, because a count has no unit to tell it apart', () => {
    expect(formatSignedCount(2)).toBe('+2');
    expect(formatSignedCount(-1)).toBe('-1');
    expect(formatSignedCount(0)).toBe('±0');
  });
});

describe('trend and polarity', () => {
  it('reads the direction from the sign alone, with zero as flat', () => {
    expect(trendOf(0.1)).toBe('up');
    expect(trendOf(-0.1)).toBe('down');
    expect(trendOf(0)).toBe('flat');
  });

  it('has an arrow for each direction and nothing for flat', () => {
    expect(TREND_ARROW).toEqual({ up: '▲', down: '▼', flat: '' });
  });

  it('colours a rise as good only when higher is better', () => {
    expect(trendVariant(1, 'higher-better')).toBe('positive');
    expect(trendVariant(-1, 'higher-better')).toBe('negative');
    expect(trendVariant(1, 'higher-worse')).toBe('negative');
    expect(trendVariant(-1, 'higher-worse')).toBe('positive');
  });

  it('is neutral for zero, whatever the polarity, and for a neutral polarity', () => {
    expect(trendVariant(0, 'higher-better')).toBe('neutral');
    expect(trendVariant(0, 'higher-worse')).toBe('neutral');
    expect(trendVariant(5, 'neutral')).toBe('neutral');
    expect(trendVariant(-5, 'neutral')).toBe('neutral');
  });
});
