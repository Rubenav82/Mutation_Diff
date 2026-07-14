import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateHtmlReport } from './htmlReportGenerator.js';
import { compareRuns } from '../compare/comparisonEngine.js';
import { parsePitestReport } from '../parsers/pitestParser.js';
import type { ComparisonResult, UnitComparison, UnitMetrics } from '../domain/types.js';

const fixturesDir = fileURLToPath(new URL('../../test/fixtures/pitest/', import.meta.url));

function readFixture(relativePath: string): string {
  return readFileSync(fixturesDir + relativePath, 'utf-8');
}

function metrics(overrides: Partial<UnitMetrics> = {}): UnitMetrics {
  return {
    total: 1,
    killed: 1,
    survived: 0,
    noCoverage: 0,
    timeout: 0,
    error: 0,
    ignored: 0,
    validTotal: 1,
    score: 100,
    coveredPct: 100,
    ...overrides,
  };
}

function section(html: string, heading: string): string {
  const start = html.indexOf(`<h2>${heading}`);
  if (start === -1) throw new Error(`section not found: ${heading}`);
  const nextSectionStart = html.indexOf('<section>', start);
  const end = nextSectionStart === -1 ? html.indexOf('</body>', start) : nextSectionStart;
  return html.slice(start, end);
}

describe('generateHtmlReport — mini PiTest comparison', () => {
  const base = parsePitestReport(readFixture('mini/base.xml'), {
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const head = parsePitestReport(readFixture('mini/head.xml'), {
    createdAt: '2026-01-02T00:00:00.000Z',
  });
  const result = compareRuns(base, head);
  const html = generateHtmlReport(result);

  it('produces a single self-contained HTML document with no external references', () => {
    expect(html.trim().toLowerCase().startsWith('<!doctype html')).toBe(true);
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<link[^>]*\shref=/i);
  });

  it('includes the global summary with formatted score/coverage deltas', () => {
    const summary = section(html, 'Resumen');
    expect(summary).toContain('80.0%');
    expect(summary).toContain('50.0%');
    expect(summary).toContain('-30.0%');
  });

  it('limits the regressions section to regressed units only', () => {
    const regressions = section(html, 'Regresiones');
    expect(regressions).toContain('com.example.StringUtils');
    expect(regressions).not.toContain('com.example.MathHelper');
    expect(regressions).not.toContain('com.example.Calculator');
    expect(regressions).not.toContain('com.example.Legacy');
    expect(regressions).not.toContain('com.example.NewFeature');
  });

  it('limits the uncovered section to units flagged isUncovered', () => {
    const uncovered = section(html, 'Sin cobertura');
    expect(uncovered).toContain('com.example.NewFeature');
    expect(uncovered).not.toContain('com.example.MathHelper');
    expect(uncovered).not.toContain('com.example.StringUtils');
  });

  it('includes the full table with every unit and its Spanish state label', () => {
    const full = section(html, 'Todas las unidades');
    expect(full).toContain('com.example.Calculator');
    expect(full).toContain('com.example.StringUtils');
    expect(full).toContain('com.example.MathHelper');
    expect(full).toContain('com.example.Legacy');
    expect(full).toContain('com.example.NewFeature');
    expect(full).toContain('Mejora ▲');
    expect(full).toContain('Regresión ▼');
    expect(full).toContain('Igual');
    expect(full).toContain('Nueva');
    expect(full).toContain('Eliminada');
  });
});

describe('generateHtmlReport — XSS safety', () => {
  it('HTML-escapes unit keys instead of injecting them raw', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const unit: UnitComparison = {
      key: malicious,
      kind: 'added',
      head: metrics(),
      scoreDelta: null,
      coverageDelta: null,
      isUncovered: false,
    };
    const result: ComparisonResult = {
      tool: 'pitest',
      global: { base: metrics(), head: metrics(), scoreDelta: 0, coverageDelta: 0 },
      units: [unit],
      regressions: [],
      uncovered: [],
      added: [unit],
      removed: [],
    };

    const html = generateHtmlReport(result);

    expect(html).not.toContain(malicious);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('generateHtmlReport — empty comparison', () => {
  it('renders without throwing and shows friendly empty-state messages', () => {
    const empty: ComparisonResult = {
      tool: 'pitest',
      global: {
        base: metrics({ total: 0, killed: 0, validTotal: 0, score: 0, coveredPct: 0 }),
        head: metrics({ total: 0, killed: 0, validTotal: 0, score: 0, coveredPct: 0 }),
        scoreDelta: 0,
        coverageDelta: 0,
      },
      units: [],
      regressions: [],
      uncovered: [],
      added: [],
      removed: [],
    };

    expect(() => generateHtmlReport(empty)).not.toThrow();
    const html = generateHtmlReport(empty);
    expect(html).toContain('No hay regresiones');
    expect(html).toContain('No hay clases');
  });
});

describe('generateHtmlReport — size budget (CA-HU-07)', () => {
  it('stays under 2 MB for up to 5000 units', () => {
    const units: UnitComparison[] = Array.from({ length: 5000 }, (_, i) => ({
      key: `com.example.generated.Class${i}`,
      kind: 'unchanged',
      base: metrics(),
      head: metrics(),
      scoreDelta: 0,
      coverageDelta: 0,
      isUncovered: false,
    }));
    const result: ComparisonResult = {
      tool: 'pitest',
      global: { base: metrics(), head: metrics(), scoreDelta: 0, coverageDelta: 0 },
      units,
      regressions: [],
      uncovered: [],
      added: [],
      removed: [],
    };

    const html = generateHtmlReport(result);
    const bytes = Buffer.byteLength(html, 'utf-8');
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });
});
