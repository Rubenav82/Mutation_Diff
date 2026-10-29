import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { compareMutants, isUndetected } from './mutantComparison.js';
import { parseStrykerReport } from '../parsers/strykerParser.js';
import type { Mutant, MutantComparison, MutantStatus, NormalizedRun } from '../domain/types.js';

let nextId = 0;

function mutant(line: number, mutator: string, status: MutantStatus, description?: string): Mutant {
  nextId += 1;
  return {
    id: String(nextId),
    mutator,
    line,
    status,
    ...(description !== undefined ? { description } : {}),
  };
}

describe('compareMutants — classification of a matched mutant', () => {
  it.each<[MutantStatus, MutantStatus, string]>([
    ['killed', 'survived', 'newly-survived'],
    ['timeout', 'survived', 'newly-survived'],
    ['no_coverage', 'survived', 'newly-survived'],
    ['survived', 'killed', 'newly-killed'],
    ['no_coverage', 'killed', 'newly-killed'],
    ['survived', 'timeout', 'newly-killed'],
    ['killed', 'no_coverage', 'newly-uncovered'],
    ['survived', 'no_coverage', 'newly-uncovered'],
    ['killed', 'timeout', 'changed'],
    ['timeout', 'killed', 'changed'],
    ['survived', 'error', 'changed'],
    ['error', 'killed', 'newly-killed'],
    ['killed', 'ignored', 'changed'],
  ])('%s → %s is %s', (base, head, kind) => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', base)],
      [mutant(10, 'MathMutator', head)],
    );
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', base, head, kind }]);
  });

  it('omits a mutant whose status did not change', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'killed')],
    );
    expect(result).toEqual([]);
  });

  it('omits an unchanged survivor too, not only unchanged killed mutants', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'survived')],
      [mutant(10, 'MathMutator', 'survived')],
    );
    expect(result).toEqual([]);
  });
});

describe('compareMutants — mutants present on one side only', () => {
  it('reports a mutant missing from head as removed, with only the base status', () => {
    const result = compareMutants([mutant(10, 'MathMutator', 'killed')], []);
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', base: 'killed', kind: 'removed' }]);
  });

  it('reports a mutant missing from base as added, with only the head status', () => {
    const result = compareMutants([], [mutant(10, 'MathMutator', 'survived')]);
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', head: 'survived', kind: 'added' }]);
  });

  it('does not match mutants that share the line but not the mutator', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'ReturnValsMutator', 'killed')],
    );
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'killed', kind: 'removed' },
      { line: 10, mutator: 'ReturnValsMutator', head: 'killed', kind: 'added' },
    ]);
  });

  it('does not match mutants on different lines whose description differs', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'a + b → a - b')],
      [mutant(11, 'MathMutator', 'killed', 'a * b → a / b')],
    );
    expect(result).toEqual([
      {
        line: 10,
        mutator: 'MathMutator',
        base: 'killed',
        kind: 'removed',
        description: 'a + b → a - b',
      },
      {
        line: 11,
        mutator: 'MathMutator',
        head: 'killed',
        kind: 'added',
        description: 'a * b → a / b',
      },
    ]);
  });
});

describe('compareMutants — code shifted by inserted or deleted lines', () => {
  it('realigns a shifted block whose statuses did not change, reporting nothing', () => {
    const result = compareMutants(
      [
        mutant(10, 'MathMutator', 'killed', 'a + b'),
        mutant(12, 'ReturnValsMutator', 'survived', 'return 0'),
      ],
      [
        mutant(21, 'MathMutator', 'killed', 'a + b'),
        mutant(23, 'ReturnValsMutator', 'survived', 'return 0'),
      ],
    );
    expect(result).toEqual([]);
  });

  it('realigns code that moved up as well as down', () => {
    const result = compareMutants(
      [mutant(30, 'MathMutator', 'survived', 'a + b')],
      [mutant(5, 'MathMutator', 'survived', 'a + b')],
    );
    expect(result).toEqual([]);
  });

  it('reports a shifted mutant that changed status at its new line', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'a + b')],
      [mutant(21, 'MathMutator', 'survived', 'a + b')],
    );
    expect(result).toEqual([
      {
        line: 21,
        mutator: 'MathMutator',
        base: 'killed',
        head: 'survived',
        kind: 'newly-survived',
        description: 'a + b',
      },
    ]);
  });

  it('keeps only the genuinely new mutant when code is inserted above others', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'a + b'), mutant(20, 'MathMutator', 'killed', 'c + d')],
      [
        mutant(10, 'ConditionalsMutator', 'survived', 'if (true)'),
        mutant(15, 'MathMutator', 'killed', 'a + b'),
        mutant(25, 'MathMutator', 'killed', 'c + d'),
      ],
    );
    expect(result).toEqual([
      {
        line: 10,
        mutator: 'ConditionalsMutator',
        head: 'survived',
        kind: 'added',
        description: 'if (true)',
      },
    ]);
  });

  it('aligns in order of appearance, like a text diff, so a reordered pair is not invented', () => {
    // A y B intercambian su sitio: solo uno de los dos puede alinearse sin cruzar
    // al otro, y el que no se alinea sale como eliminado + nuevo.
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'A'), mutant(20, 'MathMutator', 'killed', 'B')],
      [mutant(31, 'MathMutator', 'killed', 'B'), mutant(41, 'MathMutator', 'killed', 'A')],
    );
    // Ante el empate se descarta primero el de base, como un diff lista antes las
    // líneas borradas que las añadidas: se alinea B y A queda fuera.
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'killed', kind: 'removed', description: 'A' },
      { line: 41, mutator: 'MathMutator', head: 'killed', kind: 'added', description: 'A' },
    ]);
  });

  it('takes the longest alignment when an unmatched mutant leads the head side', () => {
    const result = compareMutants(
      [
        mutant(2, 'MathMutator', 'killed', 'Z'),
        mutant(3, 'MathMutator', 'killed', 'A'),
        mutant(4, 'MathMutator', 'killed', 'R'),
      ],
      [
        mutant(11, 'MathMutator', 'killed', 'P'),
        mutant(12, 'MathMutator', 'killed', 'Z'),
        mutant(13, 'MathMutator', 'killed', 'A'),
        mutant(14, 'MathMutator', 'killed', 'Q'),
      ],
    );
    expect(result.map((change) => `${change.kind} ${change.description}`)).toEqual([
      'removed R',
      'added P',
      'added Q',
    ]);
  });

  it('takes the longest alignment when an unmatched mutant leads the base side', () => {
    const result = compareMutants(
      [
        mutant(1, 'MathMutator', 'killed', 'P'),
        mutant(2, 'MathMutator', 'killed', 'Z'),
        mutant(3, 'MathMutator', 'killed', 'A'),
        mutant(4, 'MathMutator', 'killed', 'Q'),
      ],
      [
        mutant(12, 'MathMutator', 'killed', 'Z'),
        mutant(13, 'MathMutator', 'killed', 'A'),
        mutant(14, 'MathMutator', 'killed', 'R'),
      ],
    );
    expect(result.map((change) => `${change.kind} ${change.description}`)).toEqual([
      'removed P',
      'removed Q',
      'added R',
    ]);
  });

  it('compares the common trailing mutants too, not only the leading ones', () => {
    const result = compareMutants(
      [mutant(1, 'MathMutator', 'killed', 'P'), mutant(10, 'MathMutator', 'killed', 'A')],
      [mutant(1, 'MathMutator', 'killed', 'Q'), mutant(20, 'MathMutator', 'survived', 'A')],
    );
    expect(result).toEqual([
      {
        line: 20,
        mutator: 'MathMutator',
        base: 'killed',
        head: 'survived',
        kind: 'newly-survived',
        description: 'A',
      },
    ]);
  });

  it('compares the mutants aligned in the changed middle, not only the common ends', () => {
    const result = compareMutants(
      [
        mutant(1, 'MathMutator', 'killed', 'P'),
        mutant(10, 'MathMutator', 'killed', 'A'),
        mutant(20, 'MathMutator', 'killed', 'Q'),
      ],
      [
        mutant(5, 'MathMutator', 'killed', 'R'),
        mutant(15, 'MathMutator', 'survived', 'A'),
        mutant(25, 'MathMutator', 'killed', 'S'),
      ],
    );
    expect(result.map((change) => `${change.kind} ${change.description}`)).toEqual([
      'removed P',
      'added R',
      'newly-survived A',
      'removed Q',
      'added S',
    ]);
  });

  it('does not pair a mutant twice when one side is entirely common prefix', () => {
    expect(
      compareMutants(
        [mutant(10, 'MathMutator', 'killed', 'A')],
        [mutant(10, 'MathMutator', 'killed', 'A'), mutant(20, 'MathMutator', 'survived', 'A')],
      ),
    ).toEqual([
      { line: 20, mutator: 'MathMutator', head: 'survived', kind: 'added', description: 'A' },
    ]);
    expect(
      compareMutants(
        [mutant(10, 'MathMutator', 'killed', 'A'), mutant(20, 'MathMutator', 'survived', 'A')],
        [mutant(10, 'MathMutator', 'killed', 'A')],
      ),
    ).toEqual([
      { line: 20, mutator: 'MathMutator', base: 'survived', kind: 'removed', description: 'A' },
    ]);
  });

  it('still pairs by line + mutator a mutant whose description changed in place', () => {
    // Sin cambio de estado no hay nada que contar: es el mismo mutante con otro texto.
    expect(
      compareMutants(
        [mutant(10, 'MathMutator', 'killed', 'a + b')],
        [mutant(10, 'MathMutator', 'killed', 'a + c')],
      ),
    ).toEqual([]);
  });

  it('reports the surplus of a line + mutator group on whichever side it is', () => {
    expect(
      compareMutants(
        [mutant(10, 'MathMutator', 'killed', 'a'), mutant(10, 'MathMutator', 'killed', 'b')],
        [mutant(10, 'MathMutator', 'killed', 'c')],
      ),
    ).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'killed', kind: 'removed', description: 'b' },
    ]);
    expect(
      compareMutants(
        [mutant(10, 'MathMutator', 'killed', 'c')],
        [mutant(10, 'MathMutator', 'killed', 'a'), mutant(10, 'MathMutator', 'killed', 'b')],
      ),
    ).toEqual([
      { line: 10, mutator: 'MathMutator', head: 'killed', kind: 'added', description: 'b' },
    ]);
  });

  it('orders the leftovers by line before aligning, not by their order in the report', () => {
    // El JSON de Stryker no garantiza orden por línea: el desplazamiento se ve
    // en el orden del fichero, que es el de las líneas.
    const result = compareMutants(
      [mutant(20, 'MathMutator', 'killed', 'B'), mutant(10, 'MathMutator', 'killed', 'A')],
      [mutant(21, 'MathMutator', 'killed', 'A'), mutant(31, 'MathMutator', 'killed', 'B')],
    );
    expect(result).toEqual([]);
  });

  it('sorts each line canonically, since Stryker reorders a line between runs', () => {
    // Visto en la fixture real: misma línea, mismas columnas, otro orden en el JSON.
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'A'), mutant(10, 'MathMutator', 'killed', 'B')],
      [mutant(20, 'MathMutator', 'killed', 'B'), mutant(20, 'MathMutator', 'killed', 'A')],
    );
    expect(result).toEqual([]);
  });

  it('aligns before pairing by line, so a mutant that lands on a vacated line is not mistaken for it', () => {
    // Tras desplazar 10 líneas, el «true» movido cae en la 20, donde estaba el
    // «false»: emparejando primero por línea + mutador, los dos se confundían.
    const result = compareMutants(
      [
        mutant(10, 'ConditionalExpression', 'killed', 'true'),
        mutant(20, 'ConditionalExpression', 'killed', 'false'),
      ],
      [
        mutant(20, 'ConditionalExpression', 'killed', 'true'),
        mutant(30, 'ConditionalExpression', 'killed', 'false'),
      ],
    );
    expect(result).toEqual([]);
  });

  describe('alignment budget', () => {
    // Un primer y un último mutante distintos en cada lado impiden recortar prefijo y
    // sufijo comunes, así que la tabla cubre todo lo de en medio.
    function run(side: 'base' | 'head', count: number, offset: number): Mutant[] {
      const middle = Array.from({ length: count }, (_, i) =>
        mutant(i + 2 + offset, 'MathMutator', 'killed', 'a + b'),
      );
      return [
        mutant(1 + offset, 'MathMutator', 'killed', `first ${side}`),
        ...middle,
        mutant(count + 2 + offset, 'MathMutator', 'killed', `last ${side}`),
      ];
    }

    it('realigns up to a million cells (1000 × 1000 mutants)', () => {
      const result = compareMutants(run('base', 998, 0), run('head', 998, 5000));
      expect(result.map((change) => change.description).sort()).toEqual([
        'first base',
        'first head',
        'last base',
        'last head',
      ]);
    });

    it('leaves the stretch to the line + mutator pass beyond that, instead of an unbounded table', () => {
      const result = compareMutants(run('base', 999, 0), run('head', 998, 5000));
      expect(result).toHaveLength(1001 + 1000);
      expect(result.filter((change) => change.kind === 'removed')).toHaveLength(1001);
    });

    it('trims the common ends before sizing the table, so a long unchanged tail still aligns', () => {
      // Sin recortar, el primer mutante distinto deja 1001 × 1001 celdas, por
      // encima del tope; recortando la cola común, la tabla es de 1 × 1.
      const tail = (offset: number) =>
        Array.from({ length: 1000 }, (_, i) =>
          mutant(i + 2 + offset, 'MathMutator', 'killed', 'a + b'),
        );
      const result = compareMutants(
        [mutant(1, 'MathMutator', 'killed', 'first base'), ...tail(0)],
        [mutant(5001, 'MathMutator', 'killed', 'first head'), ...tail(5000)],
      );
      expect(result.map((change) => change.description)).toEqual(['first base', 'first head']);
    });
  });
});

describe('compareMutants — real Stryker runs where code was inserted (T-103 → T-107)', () => {
  const fixturesDir = fileURLToPath(
    new URL('../../test/fixtures/stryker/line-shift/', import.meta.url),
  );
  let base: NormalizedRun;
  let head: NormalizedRun;

  beforeAll(() => {
    const load = (name: string) =>
      parseStrykerReport(readFileSync(`${fixturesDir}${name}.json`, 'utf-8'), {
        createdAt: '2026-10-29T00:00:00Z',
      });
    base = load('base');
    head = load('head');
  });

  function changesOf(key: string): MutantComparison[] {
    const b = base.units.find((unit) => unit.key === key);
    const h = head.units.find((unit) => unit.key === key);
    return compareMutants(b?.mutants ?? [], h?.mutants ?? []);
  }

  it('reduces mutantComparison.ts to the mutants of the 11 inserted lines', () => {
    // Antes de T-110: 88 entradas (39 eliminados + 49 nuevos), ningún cambio de
    // estado. Lo nuevo de verdad son los 10 mutantes de `isUndetected`.
    const changes = changesOf('packages/core/src/compare/mutantComparison.ts');
    expect(changes).toHaveLength(10);
    expect(changes.every((change) => change.kind === 'added')).toBe(true);
  });

  it('invents no status change in htmlReportGenerator.ts, where nothing changed status', () => {
    const changes = changesOf('packages/core/src/report/htmlReportGenerator.ts');
    // Antes de T-110: 303 entradas. Las 29 que quedan son las líneas cuyo texto
    // cambió al renombrar «survivors» a «undetected» en T-107: con otro texto, el
    // mutante tiene otra descripción y sale, con razón, como eliminado + nuevo.
    expect(changes.filter((c) => c.kind !== 'added' && c.kind !== 'removed')).toEqual([]);
    expect(changes).toHaveLength(29);
  });
});

describe('compareMutants — several mutants of the same mutator on the same line', () => {
  it('pairs them by order of appearance', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
    );
    expect(result).toEqual([
      {
        line: 10,
        mutator: 'MathMutator',
        base: 'killed',
        head: 'survived',
        kind: 'newly-survived',
      },
    ]);
  });

  it('reports the surplus on the base side as removed', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
      [mutant(10, 'MathMutator', 'killed')],
    );
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'survived', kind: 'removed' },
    ]);
  });

  it('reports the surplus on the head side as added', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
    );
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', head: 'survived', kind: 'added' }]);
  });

  it('pairs by order within the group even when the sides interleave other mutants', () => {
    const result = compareMutants(
      [
        mutant(10, 'MathMutator', 'killed'),
        mutant(12, 'ReturnValsMutator', 'killed'),
        mutant(10, 'MathMutator', 'survived'),
      ],
      [
        mutant(12, 'ReturnValsMutator', 'killed'),
        mutant(10, 'MathMutator', 'killed'),
        mutant(10, 'MathMutator', 'killed'),
      ],
    );
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'survived', head: 'killed', kind: 'newly-killed' },
    ]);
  });
});

describe('compareMutants — description', () => {
  it('carries the head description when both sides have one', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'old text')],
      [mutant(10, 'MathMutator', 'survived', 'new text')],
    );
    expect(result[0]?.description).toBe('new text');
  });

  it('falls back to the base description for a removed mutant', () => {
    const result = compareMutants([mutant(10, 'MathMutator', 'killed', 'base text')], []);
    expect(result[0]?.description).toBe('base text');
  });

  it('falls back to the base description when only base has one', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'base text')],
      [mutant(10, 'MathMutator', 'survived')],
    );
    expect(result[0]?.description).toBe('base text');
  });

  it('omits the description key entirely when neither side has one', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'survived')],
    );
    expect(result[0]).not.toHaveProperty('description');
  });
});

describe('compareMutants — ordering', () => {
  it('sorts by line ascending regardless of the order in either run', () => {
    const result = compareMutants(
      [mutant(30, 'MathMutator', 'killed'), mutant(5, 'MathMutator', 'killed')],
      [mutant(30, 'MathMutator', 'survived'), mutant(5, 'MathMutator', 'survived')],
    );
    expect(result.map((m) => m.line)).toEqual([5, 30]);
  });

  it('sorts aligned changes and leftovers together by line', () => {
    // El cambio de estado de la 20 sale de la alineación y el eliminado de la 5 de
    // lo que sobra: se generan en ese orden, y es la ordenación final la que los pone.
    const result = compareMutants(
      [mutant(5, 'MathMutator', 'killed', 'x'), mutant(20, 'MathMutator', 'killed', 'y')],
      [mutant(20, 'MathMutator', 'survived', 'y')],
    );
    expect(result.map((m) => m.line)).toEqual([5, 20]);
  });

  it('breaks ties on the same line by mutator also between aligned changes and leftovers', () => {
    const result = compareMutants(
      [mutant(10, 'ZMutator', 'killed', 'z'), mutant(10, 'AMutator', 'killed', 'a')],
      [mutant(10, 'ZMutator', 'survived', 'z')],
    );
    expect(result.map((m) => m.mutator)).toEqual(['AMutator', 'ZMutator']);
  });

  it('sorts numerically, not lexicographically (10 after 9)', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(9, 'MathMutator', 'killed')],
      [],
    );
    expect(result.map((m) => m.line)).toEqual([9, 10]);
  });

  it('breaks ties on the same line by mutator name', () => {
    const result = compareMutants(
      [mutant(10, 'ReturnValsMutator', 'killed'), mutant(10, 'MathMutator', 'killed')],
      [],
    );
    expect(result.map((m) => m.mutator)).toEqual(['MathMutator', 'ReturnValsMutator']);
  });

  it('keeps pairing order within the same line and mutator', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
      [mutant(10, 'MathMutator', 'survived'), mutant(10, 'MathMutator', 'killed')],
    );
    expect(result.map((m) => m.kind)).toEqual(['newly-survived', 'newly-killed']);
  });
});

describe('isUndetected', () => {
  function change(
    kind: MutantComparison['kind'],
    head: MutantStatus | undefined,
    base?: MutantStatus,
  ): MutantComparison {
    return {
      line: 10,
      mutator: 'MathMutator',
      kind,
      ...(base !== undefined ? { base } : {}),
      ...(head !== undefined ? { head } : {}),
    };
  }

  it.each<[MutantComparison['kind'], MutantStatus]>([
    ['newly-survived', 'survived'],
    ['newly-uncovered', 'no_coverage'],
    ['added', 'survived'],
    ['added', 'no_coverage'],
  ])('is true for a %s mutant that ends up %s', (kind, head) => {
    expect(isUndetected(change(kind, head, 'killed'))).toBe(true);
  });

  it.each<[MutantComparison['kind'], MutantStatus]>([
    ['newly-killed', 'killed'],
    ['changed', 'timeout'],
    ['changed', 'error'],
    ['changed', 'ignored'],
    ['added', 'killed'],
  ])('is false for a %s mutant that ends up %s', (kind, head) => {
    expect(isUndetected(change(kind, head, 'survived'))).toBe(false);
  });

  it('is false for a mutant that no longer exists, whatever it was before', () => {
    // Un mutante eliminado no puede empeorar nada: ya no hay código que mutar.
    expect(isUndetected(change('removed', undefined, 'survived'))).toBe(false);
  });
});
