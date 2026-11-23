import { describe, expect, it } from 'vitest';
import { parseReportFile } from './reportParser';
import pitestBase from '../../../core/test/fixtures/pitest/realistic/base.xml?raw';
import strykerBase from '../../../core/test/fixtures/stryker/realistic/base.json?raw';

const CREATED_AT = '2026-11-23T10:00:00.000Z';

describe('parseReportFile', () => {
  it('parses a PiTest report, labelled with the file name', async () => {
    const response = await parseReportFile({
      tool: 'pitest',
      file: new File([pitestBase], 'sprint-11.xml'),
      createdAt: CREATED_AT,
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.run.tool).toBe('pitest');
    expect(response.run.label).toBe('sprint-11.xml');
    expect(response.run.createdAt).toBe(CREATED_AT);
    expect(response.run.units.map((unit) => unit.key)).toContain('com.acme.billing.TaxCalculator');
  });

  it('parses a Stryker report', async () => {
    const response = await parseReportFile({
      tool: 'stryker',
      file: new File([strykerBase], 'mutation.json'),
      createdAt: CREATED_AT,
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.run.tool).toBe('stryker');
  });

  it('answers an invalid report with its reason as data, not as an error', async () => {
    // La respuesta cruza de un worker al hilo principal: una instancia de
    // `InvalidReportError` llegaría como un `Error` pelado, sin su `reason`.
    const response = await parseReportFile({
      tool: 'pitest',
      file: new File(['<testsuite></testsuite>'], 'TEST-junit.xml'),
      createdAt: CREATED_AT,
    });

    expect(response).toEqual({ ok: false, reason: { code: 'missing-root' } });
  });

  it('answers a failure the parsers did not anticipate with no reason', async () => {
    const response = await parseReportFile({
      tool: 'stryker',
      file: new File(['{"schemaVersion":"2.0","files":{"a.js":null}}'], 'mutation.json'),
      createdAt: CREATED_AT,
    });

    expect(response).toEqual({ ok: false, reason: null });
  });
});
