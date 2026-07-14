import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * T-010: valida que las fixtures reales de PiTest/Stryker exigidas por
 * docs/tasks.md existen y tienen una forma mínima válida, antes de que
 * T-011/T-012 escriban los parsers que las consumen.
 */
const fixturesDir = fileURLToPath(new URL('../test/fixtures/', import.meta.url));

function read(relativePath: string): string {
  return readFileSync(fixturesDir + relativePath, 'utf-8');
}

function assertWellFormedPitestXml(xml: string): void {
  expect(xml.trim().startsWith('<?xml')).toBe(true);
  expect(xml).toContain('<mutations>');
  expect(xml).toContain('</mutations>');
  const opens = xml.match(/<mutation /g)?.length ?? 0;
  const closes = xml.match(/<\/mutation>/g)?.length ?? 0;
  expect(opens).toBeGreaterThan(0);
  expect(opens).toBe(closes);
}

function assertWellFormedStrykerReport(json: string): void {
  const parsed = JSON.parse(json) as { schemaVersion?: unknown; files?: Record<string, unknown> };
  expect(typeof parsed.schemaVersion).toBe('string');
  expect(parsed.files).toBeDefined();
  expect(Object.keys(parsed.files ?? {}).length).toBeGreaterThan(0);
}

describe('T-010 fixtures', () => {
  describe.each([
    ['pitest/mini/base.xml'],
    ['pitest/mini/head.xml'],
    ['pitest/realistic/base.xml'],
    ['pitest/realistic/head.xml'],
  ])('%s', (relativePath) => {
    it('is a well-formed PiTest mutations.xml', () => {
      assertWellFormedPitestXml(read(relativePath));
    });
  });

  describe.each([
    ['stryker/mini/base.json'],
    ['stryker/mini/head.json'],
    ['stryker/realistic/base.json'],
    ['stryker/realistic/head.json'],
  ])('%s', (relativePath) => {
    it('is a well-formed Stryker mutation report', () => {
      assertWellFormedStrykerReport(read(relativePath));
    });
  });
});
