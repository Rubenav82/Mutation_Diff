import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ApiError, errorHandler } from './errors.js';

function buildApp(handler: (req: express.Request, res: express.Response) => void) {
  const app = express();
  app.get('/boom', handler);
  app.use(errorHandler);
  return app;
}

describe('ApiError', () => {
  it('carries status, code and message', () => {
    const err = new ApiError(404, 'NOT_FOUND', 'unit not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('unit not found');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('errorHandler', () => {
  it('responds with the ApiError status/code/message shape when an ApiError is thrown', async () => {
    const app = buildApp(() => {
      throw new ApiError(404, 'NOT_FOUND', 'nope');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'nope' } });
  });

  it('maps an unrecognized error to a generic 500 without leaking its message or a stack trace', async () => {
    const app = buildApp(() => {
      throw new Error('sensitive internal detail /etc/passwd');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).not.toContain('sensitive internal detail');
    expect(res.body.error.message).not.toContain('/etc/passwd');
    expect(res.text).not.toMatch(/at .*:\d+:\d+/);
  });

  it('catches errors thrown from an async handler (Express 5 native promise support)', async () => {
    const app = buildApp(async () => {
      await Promise.resolve();
      throw new ApiError(422, 'VALIDATION_ERROR', 'bad input');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'bad input' } });
  });
});
