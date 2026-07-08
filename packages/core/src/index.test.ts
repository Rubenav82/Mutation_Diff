import { describe, expect, it } from 'vitest';
import { version } from './index.js';

describe('core bootstrap', () => {
  it('exposes the package version through the ESM entry point', () => {
    expect(version).toBe('0.0.0');
  });
});
