import { describe, expect, it } from 'vitest';
import { shortMutatorName } from './mutators.js';

describe('shortMutatorName', () => {
  it('keeps only the last segment of a PiTest fully-qualified mutator', () => {
    expect(shortMutatorName('org.pitest.mutationtest.engine.gregor.mutators.MathMutator')).toBe(
      'MathMutator',
    );
  });

  it('returns a bare Stryker mutator name unchanged', () => {
    expect(shortMutatorName('ArithmeticOperator')).toBe('ArithmeticOperator');
  });

  it('returns an empty name unchanged rather than throwing', () => {
    expect(shortMutatorName('')).toBe('');
  });
});
