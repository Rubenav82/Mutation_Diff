import type { Tool } from 'core';
import { describe, expect, it } from 'vitest';
import { ComparisonError, createComparison, getComparison } from './comparisons';
// Las mismas fixtures que usan los tests de `core` y los e2e: si cambian las
// clases esperadas, salta en los tres sitios a la vez. Se cargan con `?raw` en
// vez de `node:fs` porque bajo jsdom `import.meta.url` llega como URL `/@fs/`
// y `fileURLToPath` la convierte en una ruta inexistente.
import pitestBase from '../../../core/test/fixtures/pitest/realistic/base.xml?raw';
import pitestHead from '../../../core/test/fixtures/pitest/realistic/head.xml?raw';
import strykerBase from '../../../core/test/fixtures/stryker/realistic/base.json?raw';
import strykerHead from '../../../core/test/fixtures/stryker/realistic/head.json?raw';

const FIXTURES: Record<Tool, Record<'base' | 'head', string>> = {
  pitest: { base: pitestBase, head: pitestHead },
  stryker: { base: strykerBase, head: strykerHead },
};

function fixture(tool: Tool, side: 'base' | 'head'): string {
  return FIXTURES[tool][side];
}

function reportFile(tool: Tool, side: 'base' | 'head'): File {
  const extension = tool === 'pitest' ? 'xml' : 'json';
  return new File([fixture(tool, side)], `${side}.${extension}`);
}

function keysOf(units: { key: string }[]): string[] {
  return units.map((unit) => unit.key);
}

describe('createComparison', () => {
  it('compares two PiTest reports without any network call', async () => {
    const { comparisonId, result } = await createComparison({
      tool: 'pitest',
      baseFile: reportFile('pitest', 'base'),
      headFile: reportFile('pitest', 'head'),
    });

    expect(comparisonId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.tool).toBe('pitest');
    expect(keysOf(result.regressions)).toContain('com.acme.billing.TaxCalculator');
    expect(keysOf(result.added)).toContain('com.acme.billing.RefundService');
    expect(keysOf(result.removed)).toContain('com.acme.notifications.LegacyNotifier');
  });

  it('compares two Stryker reports', async () => {
    const { result } = await createComparison({
      tool: 'stryker',
      baseFile: reportFile('stryker', 'base'),
      headFile: reportFile('stryker', 'head'),
    });

    expect(result.tool).toBe('stryker');
    expect(keysOf(result.regressions)).toContain('src/billing/taxCalculator.js');
  });

  it('labels the comparison with the two file names', async () => {
    // Lo hacía el servidor con `file.originalname`; es lo que alimenta el rail
    // de contexto, así que sin esto el dashboard no sabe de qué ficheros salió.
    const { result } = await createComparison({
      tool: 'pitest',
      baseFile: new File([fixture('pitest', 'base')], 'sprint-11.xml'),
      headFile: new File([fixture('pitest', 'head')], 'sprint-12.xml'),
    });

    expect(result.context.baseLabel).toBe('sprint-11.xml');
    expect(result.context.headLabel).toBe('sprint-12.xml');
  });

  it('forwards the thresholds to the comparison engine', async () => {
    const { result } = await createComparison({
      tool: 'stryker',
      baseFile: reportFile('stryker', 'base'),
      headFile: reportFile('stryker', 'head'),
      regressionThreshold: 5,
      uncoveredThreshold: 75,
    });

    expect(result.context.regressionThreshold).toBe(5);
    expect(result.context.uncoveredThreshold).toBe(75);
    expect(keysOf(result.uncovered)).toContain('src/billing/refundService.js');
  });

  it('applies the engine defaults when no threshold is given', async () => {
    const { result } = await createComparison({
      tool: 'pitest',
      baseFile: reportFile('pitest', 'base'),
      headFile: reportFile('pitest', 'head'),
    });

    expect(result.context.regressionThreshold).toBe(0);
    expect(result.context.uncoveredThreshold).toBe(100);
  });

  it('rejects a file that is not a valid report for the selected tool', async () => {
    const promise = createComparison({
      tool: 'pitest',
      baseFile: new File(['<mutations><mutation'], 'roto.xml'),
      headFile: reportFile('pitest', 'head'),
    });

    await expect(promise).rejects.toBeInstanceOf(ComparisonError);
    await expect(promise).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_REPORT',
    });
    await expect(promise).rejects.toThrow(/Invalid PiTest report/);
  });
});

describe('getComparison', () => {
  it('returns a comparison stored by createComparison', async () => {
    const { comparisonId, result } = await createComparison({
      tool: 'pitest',
      baseFile: reportFile('pitest', 'base'),
      headFile: reportFile('pitest', 'head'),
    });

    await expect(getComparison(comparisonId)).resolves.toEqual(result);
  });

  it('rejects an unknown id with the same shape the server used', async () => {
    const promise = getComparison('desconocido');

    await expect(promise).rejects.toBeInstanceOf(ComparisonError);
    await expect(promise).rejects.toMatchObject({
      status: 404,
      code: 'COMPARISON_NOT_FOUND',
    });
  });
});
