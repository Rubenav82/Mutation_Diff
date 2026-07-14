import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { validateBody } from './validation.js';
import { errorHandler } from './errors.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  const schema = z.object({ tool: z.enum(['pitest', 'stryker']) });
  app.post('/check', validateBody(schema), (req, res) => {
    res.json({ tool: (req.body as { tool: string }).tool });
  });
  app.use(errorHandler);
  return app;
}

describe('validateBody', () => {
  it('passes through valid data and replaces req.body with the parsed value', async () => {
    const res = await request(buildApp()).post('/check').send({ tool: 'pitest', extra: 'ignored' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tool: 'pitest' });
  });

  it('rejects a value outside the allowed enum with a homogeneous 422 error', async () => {
    const res = await request(buildApp()).post('/check').send({ tool: 'not-a-real-tool' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.text).not.toMatch(/at .*:\d+:\d+/);
  });

  it('rejects a missing required field', async () => {
    const res = await request(buildApp()).post('/check').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
