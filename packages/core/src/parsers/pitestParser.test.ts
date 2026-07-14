import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { parsePitestReport } from './pitestParser.js';

const fixturesDir = fileURLToPath(new URL('../../test/fixtures/pitest/', import.meta.url));

function readFixture(relativePath: string): string {
  return readFileSync(fixturesDir + relativePath, 'utf-8');
}

function unit(run: ReturnType<typeof parsePitestReport>, key: string) {
  const found = run.units.find((u) => u.key === key);
  if (!found) throw new Error(`unit not found: ${key}`);
  return found;
}

describe('parsePitestReport — mini fixtures', () => {
  let base: ReturnType<typeof parsePitestReport>;
  let head: ReturnType<typeof parsePitestReport>;

  beforeAll(() => {
    base = parsePitestReport(readFixture('mini/base.xml'), {
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    head = parsePitestReport(readFixture('mini/head.xml'), {
      createdAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('sets tool and passthrough metadata', () => {
    expect(base.tool).toBe('pitest');
    expect(base.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('groups mutations by mutatedClass into one unit per class', () => {
    expect(base.units).toHaveLength(4);
    expect(base.units.map((u) => u.key).sort()).toEqual([
      'com.example.Calculator',
      'com.example.Legacy',
      'com.example.MathHelper',
      'com.example.StringUtils',
    ]);
  });

  it('maps PiTest statuses to normalized MutantStatus', () => {
    const calculator = unit(base, 'com.example.Calculator');
    expect(calculator.mutants).toHaveLength(2);
    expect(calculator.mutants.map((m) => m.status).sort()).toEqual(['killed', 'survived']);

    const newFeature = unit(head, 'com.example.NewFeature');
    expect(newFeature.mutants.every((m) => m.status === 'no_coverage')).toBe(true);
  });

  it('preserves mutant line, mutator, description and id', () => {
    const calculator = unit(base, 'com.example.Calculator');
    const addMutant = calculator.mutants.find((m) => m.line === 10);
    expect(addMutant).toBeDefined();
    expect(addMutant?.status).toBe('killed');
    expect(addMutant?.mutator).toBe('org.pitest.mutationtest.engine.gregor.mutators.MathMutator');
    expect(addMutant?.description).toBe('Replaced integer addition with subtraction');
    expect(addMutant?.id).toBeTruthy();
  });

  it('assigns distinct, increasing ids across mutants in parse order', () => {
    const calculator = unit(base, 'com.example.Calculator');
    const ids = calculator.mutants.map((m) => Number(m.id));
    expect(ids[1]).toBe((ids[0] ?? 0) + 1);
  });

  it('includes the optional label when provided, omits the key otherwise', () => {
    const withLabel = parsePitestReport(readFixture('mini/base.xml'), {
      createdAt: '2026-01-01T00:00:00.000Z',
      label: 'release-1.2',
    });
    expect(withLabel.label).toBe('release-1.2');
    expect('label' in base).toBe(false);
  });

  it('computes per-unit metrics from the mapped statuses', () => {
    const calculator = unit(base, 'com.example.Calculator'); // 1 killed, 1 survived
    expect(calculator.metrics.score).toBeCloseTo(50);
    expect(calculator.metrics.coveredPct).toBeCloseTo(100);

    const stringUtils = unit(base, 'com.example.StringUtils'); // 1 killed
    expect(stringUtils.metrics.score).toBeCloseTo(100);

    const newFeature = unit(head, 'com.example.NewFeature'); // 2 no_coverage
    expect(newFeature.metrics.score).toBeCloseTo(0);
    expect(newFeature.metrics.coveredPct).toBeCloseTo(0);
  });

  it('computes the global aggregate across all units', () => {
    // base: 4 killed, 1 survived, validTotal 5 -> score 80, coveredPct 100
    expect(base.metrics.total).toBe(5);
    expect(base.metrics.score).toBeCloseTo(80);
    expect(base.metrics.coveredPct).toBeCloseTo(100);

    // head: 3 killed, 1 survived, 2 no_coverage, validTotal 6 -> score 50, coveredPct 66.67
    expect(head.metrics.total).toBe(6);
    expect(head.metrics.score).toBeCloseTo(50);
    expect(head.metrics.coveredPct).toBeCloseTo((4 / 6) * 100);
  });

  it('reflects a class removed in head as absent from head.units', () => {
    expect(head.units.some((u) => u.key === 'com.example.Legacy')).toBe(false);
  });

  it('reflects a class added in head as absent from base.units', () => {
    expect(base.units.some((u) => u.key === 'com.example.NewFeature')).toBe(false);
  });
});

describe('parsePitestReport — realistic fixtures', () => {
  let base: ReturnType<typeof parsePitestReport>;

  beforeAll(() => {
    base = parsePitestReport(readFixture('realistic/base.xml'), {
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('maps TIMED_OUT and RUN_ERROR to timeout/error', () => {
    const taxCalculator = unit(base, 'com.acme.billing.TaxCalculator');
    expect(taxCalculator.mutants.some((m) => m.status === 'timeout')).toBe(true);

    const paymentGateway = unit(base, 'com.acme.billing.PaymentGateway');
    expect(paymentGateway.mutants.some((m) => m.status === 'error')).toBe(true);
  });

  it('excludes error mutants from validTotal when scoring', () => {
    const paymentGateway = unit(base, 'com.acme.billing.PaymentGateway');
    const { total, error, validTotal } = paymentGateway.metrics;
    expect(validTotal).toBe(total - error);
  });
});

describe('parsePitestReport — empty report', () => {
  it('returns a valid NormalizedRun with no units for an empty <mutations/> root', () => {
    const run = parsePitestReport('<?xml version="1.0"?><mutations></mutations>', {
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(run.units).toEqual([]);
    expect(run.metrics).toEqual({
      total: 0,
      killed: 0,
      survived: 0,
      noCoverage: 0,
      timeout: 0,
      error: 0,
      ignored: 0,
      validTotal: 0,
      score: 0,
      coveredPct: 0,
    });
  });

  it('returns a valid NormalizedRun for a self-closed <mutations/> root', () => {
    const run = parsePitestReport('<?xml version="1.0"?><mutations/>', {
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(run.units).toEqual([]);
  });
});

describe('parsePitestReport — invalid input', () => {
  it('throws a readable error for malformed XML, not a raw parser stack trace', () => {
    expect(() =>
      parsePitestReport('<mutations><mutation>', { createdAt: '2026-01-01T00:00:00.000Z' }),
    ).toThrow(/Invalid PiTest report: malformed XML \(.+ at line \d+\)/);
  });

  it('throws a readable error when the root <mutations> element is missing', () => {
    expect(() =>
      parsePitestReport('<?xml version="1.0"?><notMutations></notMutations>', {
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow('Invalid PiTest report: missing <mutations> root element');
  });

  it('throws a readable error for a mutation with an unrecognized status', () => {
    const xml = `<?xml version="1.0"?><mutations>
      <mutation detected='false' status='SOME_FUTURE_STATUS'>
        <mutatedClass>com.example.A</mutatedClass>
        <mutator>m</mutator>
        <lineNumber>1</lineNumber>
      </mutation>
    </mutations>`;
    expect(() => parsePitestReport(xml, { createdAt: '2026-01-01T00:00:00.000Z' })).toThrow(
      'Invalid PiTest report: unrecognized mutation status "SOME_FUTURE_STATUS" in class "com.example.A"',
    );
  });

  it('throws a readable error for a mutation missing <mutatedClass>', () => {
    const xml = `<?xml version="1.0"?><mutations>
      <mutation detected='true' status='KILLED'>
        <mutator>m</mutator>
        <lineNumber>1</lineNumber>
      </mutation>
    </mutations>`;
    expect(() => parsePitestReport(xml, { createdAt: '2026-01-01T00:00:00.000Z' })).toThrow(
      'Invalid PiTest report: a <mutation> is missing <mutatedClass>',
    );
  });
});

describe('parsePitestReport — additional status mappings and defaults', () => {
  it('maps MEMORY_ERROR and NON_VIABLE to the "error" status', () => {
    const xml = `<?xml version="1.0"?><mutations>
      <mutation detected='false' status='MEMORY_ERROR'>
        <mutatedClass>com.example.A</mutatedClass>
        <mutator>m</mutator>
        <lineNumber>1</lineNumber>
      </mutation>
      <mutation detected='false' status='NON_VIABLE'>
        <mutatedClass>com.example.A</mutatedClass>
        <mutator>m</mutator>
        <lineNumber>2</lineNumber>
      </mutation>
    </mutations>`;
    const run = parsePitestReport(xml, { createdAt: '2026-01-01T00:00:00.000Z' });
    expect(run.units[0]?.mutants.map((m) => m.status)).toEqual(['error', 'error']);
  });

  it('defaults mutator to an empty string when <mutator> is absent', () => {
    const xml = `<?xml version="1.0"?><mutations>
      <mutation detected='true' status='KILLED'>
        <mutatedClass>com.example.A</mutatedClass>
        <lineNumber>1</lineNumber>
      </mutation>
    </mutations>`;
    const run = parsePitestReport(xml, { createdAt: '2026-01-01T00:00:00.000Z' });
    expect(run.units[0]?.mutants[0]?.mutator).toBe('');
  });

  it('omits description entirely when <description> is absent (not just undefined)', () => {
    const xml = `<?xml version="1.0"?><mutations>
      <mutation detected='true' status='KILLED'>
        <mutatedClass>com.example.A</mutatedClass>
        <mutator>m</mutator>
        <lineNumber>1</lineNumber>
      </mutation>
    </mutations>`;
    const run = parsePitestReport(xml, { createdAt: '2026-01-01T00:00:00.000Z' });
    expect('description' in (run.units[0]?.mutants[0] ?? {})).toBe(false);
  });

  it('correctly parses a single <mutation> (isArray forcing behaviour)', () => {
    const xml = `<?xml version="1.0"?><mutations>
      <mutation detected='true' status='KILLED'>
        <mutatedClass>com.example.Solo</mutatedClass>
        <mutator>m</mutator>
        <lineNumber>1</lineNumber>
      </mutation>
    </mutations>`;
    const run = parsePitestReport(xml, { createdAt: '2026-01-01T00:00:00.000Z' });
    expect(run.units).toHaveLength(1);
    expect(run.units[0]?.mutants).toHaveLength(1);
  });

  it('returns no units when <mutations> has content but no <mutation> children', () => {
    const xml = '<?xml version="1.0"?><mutations><unrelated/></mutations>';
    const run = parsePitestReport(xml, { createdAt: '2026-01-01T00:00:00.000Z' });
    expect(run.units).toEqual([]);
  });
});
