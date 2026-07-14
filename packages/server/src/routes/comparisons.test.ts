import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const coreFixturesDir = fileURLToPath(new URL('../../../core/test/fixtures/', import.meta.url));

function fixture(relativePath: string): Buffer {
  return readFileSync(coreFixturesDir + relativePath);
}

describe('POST /api/comparisons — PiTest', () => {
  it('returns 200 with a comparisonId and the ComparisonResult for two valid mini fixtures', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .field('tool', 'pitest')
      .attach('baseFile', fixture('pitest/mini/base.xml'), 'base.xml')
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');

    expect(res.status).toBe(200);
    expect(typeof res.body.comparisonId).toBe('string');
    expect(res.body.comparisonId.length).toBeGreaterThan(0);
    expect(res.body.result.tool).toBe('pitest');
    expect(res.body.result.units).toHaveLength(5);
    expect(res.body.result.regressions.map((u: { key: string }) => u.key)).toEqual([
      'com.example.StringUtils',
    ]);
    expect(res.body.result.added.map((u: { key: string }) => u.key)).toEqual([
      'com.example.NewFeature',
    ]);
  });

  it('honors a custom regressionThreshold option', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .field('tool', 'pitest')
      .field('regressionThreshold', '100')
      .attach('baseFile', fixture('pitest/mini/base.xml'), 'base.xml')
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');

    expect(res.status).toBe(200);
    expect(res.body.result.regressions).toEqual([]);
  });
});

describe('POST /api/comparisons — Stryker', () => {
  it('returns 200 with a comparisonId and the ComparisonResult for two valid mini fixtures', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .field('tool', 'stryker')
      .attach('baseFile', fixture('stryker/mini/base.json'), 'base.json')
      .attach('headFile', fixture('stryker/mini/head.json'), 'head.json');

    expect(res.status).toBe(200);
    expect(res.body.result.tool).toBe('stryker');
    expect(res.body.result.regressions.map((u: { key: string }) => u.key)).toEqual([
      'src/stringUtils.js',
    ]);
  });
});

describe('POST /api/comparisons — validation errors', () => {
  it('returns 422 when tool is missing', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .attach('baseFile', fixture('pitest/mini/base.xml'), 'base.xml')
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when tool is not pitest or stryker', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .field('tool', 'bogus-tool')
      .attach('baseFile', fixture('pitest/mini/base.xml'), 'base.xml')
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when headFile is missing', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .field('tool', 'pitest')
      .attach('baseFile', fixture('pitest/mini/base.xml'), 'base.xml');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MISSING_FILE');
  });

  it('returns 422 with a clear message when the uploaded file does not match the declared tool', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .field('tool', 'pitest')
      .attach('baseFile', fixture('stryker/mini/base.json'), 'base.json') // JSON, not XML
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_REPORT');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('never leaks a stack trace in an error response', async () => {
    const res = await request(createApp())
      .post('/api/comparisons')
      .field('tool', 'pitest')
      .attach('baseFile', fixture('stryker/mini/base.json'), 'base.json')
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');

    expect(res.text).not.toMatch(/at .*:\d+:\d+/);
  });
});

describe('GET /api/comparisons/:id', () => {
  it('returns the ComparisonResult produced by a previous POST', async () => {
    const app = createApp();
    const postRes = await request(app)
      .post('/api/comparisons')
      .field('tool', 'pitest')
      .attach('baseFile', fixture('pitest/mini/base.xml'), 'base.xml')
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');
    const { comparisonId } = postRes.body as { comparisonId: string };

    const getRes = await request(app).get(`/api/comparisons/${comparisonId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(postRes.body.result);
  });

  it('returns a homogeneous 404 for an unknown comparison id', async () => {
    const res = await request(createApp()).get('/api/comparisons/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COMPARISON_NOT_FOUND');
  });
});

describe('GET /api/comparisons/:id/report', () => {
  it('downloads a self-contained HTML report for a previous comparison', async () => {
    const app = createApp();
    const postRes = await request(app)
      .post('/api/comparisons')
      .field('tool', 'pitest')
      .attach('baseFile', fixture('pitest/mini/base.xml'), 'base.xml')
      .attach('headFile', fixture('pitest/mini/head.xml'), 'head.xml');
    const { comparisonId } = postRes.body as { comparisonId: string };

    const res = await request(app).get(`/api/comparisons/${comparisonId}/report`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="mutadiff-report-${comparisonId}.html"`,
    );
    expect(res.text).toContain('<html');
    expect(res.text).toContain('com.example.StringUtils');
  });

  it('returns a homogeneous 404 for an unknown comparison id', async () => {
    const res = await request(createApp()).get('/api/comparisons/does-not-exist/report');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COMPARISON_NOT_FOUND');
  });
});
