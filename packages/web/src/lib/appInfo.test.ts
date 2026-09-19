import { describe, expect, it } from 'vitest';
import license from '../../../../LICENSE?raw';
import { APP_NAME, COPYRIGHT, LICENSE } from './appInfo';

describe('appInfo', () => {
  it('copies the copyright holder from LICENSE, so the panel cannot diverge from it', () => {
    const holder = COPYRIGHT.replace(/^©\s*/, '');
    expect(holder).not.toBe('');
    expect(license).toContain(`Copyright (c) ${holder}`);
  });

  it('names the licence as LICENSE does', () => {
    expect(license.startsWith(LICENSE)).toBe(true);
  });

  it('names the product', () => {
    expect(APP_NAME).toBe('Mutator Assessment Report');
  });
});
