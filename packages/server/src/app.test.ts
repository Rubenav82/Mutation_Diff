import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('createApp', () => {
  it('returns a homogeneous 404 for unknown routes, not the default Express HTML page', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) as string },
    });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('never leaks a stack trace for an unrecognized error', async () => {
    const app = createApp();
    const res = await request(app).get('/nope');
    expect(res.text).not.toMatch(/at .*:\d+:\d+/);
  });
});
