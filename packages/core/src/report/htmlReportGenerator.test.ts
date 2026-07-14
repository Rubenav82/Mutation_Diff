import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
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
  let result: ComparisonResult;
  let html: string;

  beforeAll(() => {
    const base = parsePitestReport(readFixture('mini/base.xml'), {
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const head = parsePitestReport(readFixture('mini/head.xml'), {
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    result = compareRuns(base, head);
    html = generateHtmlReport(result);
  });

  it('produces a single self-contained HTML document with no external references', () => {
    expect(html.trim().toLowerCase().startsWith('<!doctype html')).toBe(true);
    expect(html).toContain('<style>');
    expect(html).toContain('font-family');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<link[^>]*\shref=/i);
    // Stryker's default replacement for an empty string literal — a generic tripwire
    // against string-literal mutants surviving anywhere in this file.
    expect(html).not.toContain('Stryker was here');
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

  it('escapes all five characters that can break out of an HTML text node', () => {
    const key = `&<>"'`;
    const unit: UnitComparison = {
      key,
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

    expect(html).toContain('&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('generateHtmlReport — exact row and delta rendering', () => {
  it('renders exact cell text for positive, negative, zero and null score deltas', () => {
    const improved: UnitComparison = {
      key: 'Improved',
      kind: 'improved',
      base: metrics({ score: 50 }),
      head: metrics({ score: 62.34 }),
      scoreDelta: 12.34,
      coverageDelta: 0,
      isUncovered: false,
    };
    const regressed: UnitComparison = {
      key: 'Regressed',
      kind: 'regressed',
      base: metrics({ score: 90 }),
      head: metrics({ score: 81.5 }),
      scoreDelta: -8.5,
      coverageDelta: 0,
      isUncovered: false,
    };
    const unchanged: UnitComparison = {
      key: 'Unchanged',
      kind: 'unchanged',
      base: metrics({ score: 70 }),
      head: metrics({ score: 70 }),
      scoreDelta: 0,
      coverageDelta: 0,
      isUncovered: false,
    };
    const added: UnitComparison = {
      key: 'Added',
      kind: 'added',
      head: metrics({ score: 40 }),
      scoreDelta: null,
      coverageDelta: null,
      isUncovered: false,
    };
    const removed: UnitComparison = {
      key: 'Removed',
      kind: 'removed',
      base: metrics({ score: 40 }),
      scoreDelta: null,
      coverageDelta: null,
      isUncovered: false,
    };

    const result: ComparisonResult = {
      tool: 'pitest',
      global: { base: metrics(), head: metrics(), scoreDelta: 0, coverageDelta: 0 },
      units: [improved, regressed, unchanged, added, removed],
      regressions: [regressed],
      uncovered: [],
      added: [added],
      removed: [removed],
    };
    const html = generateHtmlReport(result);

    expect(html).toContain(
      '<tr class="kind-improved"><td>Improved</td><td>50.0%</td><td>62.3%</td><td>+12.3%</td><td>Mejora ▲</td></tr>',
    );
    expect(html).toContain(
      '<tr class="kind-regressed"><td>Regressed</td><td>90.0%</td><td>81.5%</td><td>-8.5%</td><td>Regresión ▼</td></tr>',
    );
    expect(html).toContain(
      '<tr class="kind-unchanged"><td>Unchanged</td><td>70.0%</td><td>70.0%</td><td>0.0%</td><td>Igual</td></tr>',
    );
    expect(html).toContain(
      '<tr class="kind-added"><td>Added</td><td>—</td><td>40.0%</td><td>—</td><td>Nueva</td></tr>',
    );
    expect(html).toContain(
      '<tr class="kind-removed"><td>Removed</td><td>40.0%</td><td>—</td><td>—</td><td>Eliminada</td></tr>',
    );
  });
});

describe('generateHtmlReport — global delta card styling', () => {
  function reportWithGlobalDelta(scoreDelta: number, coverageDelta: number): ComparisonResult {
    return {
      tool: 'pitest',
      global: { base: metrics(), head: metrics(), scoreDelta, coverageDelta },
      units: [],
      regressions: [],
      uncovered: [],
      added: [],
      removed: [],
    };
  }

  it('marks a positive delta card as positive and a negative one as negative', () => {
    const positive = generateHtmlReport(reportWithGlobalDelta(5, 5));
    expect(positive).toContain(
      '<div class="card positive"><span class="label">&Delta; Score</span><span class="value">+5.0%</span></div>',
    );

    const negative = generateHtmlReport(reportWithGlobalDelta(-5, -5));
    expect(negative).toContain(
      '<div class="card negative"><span class="label">&Delta; Score</span><span class="value">-5.0%</span></div>',
    );
  });

  it('leaves a zero delta card unstyled', () => {
    const zero = generateHtmlReport(reportWithGlobalDelta(0, 0));
    expect(zero).toContain(
      '<div class="card "><span class="label">&Delta; Score</span><span class="value">0.0%</span></div>',
    );
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
    expect(html).toContain('No hay regresiones.');
    expect(html).toContain('No hay clases/ficheros sin cobertura.');
    expect(html).toContain('No hay unidades.');
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
