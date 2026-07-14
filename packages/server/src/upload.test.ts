import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createUpload, MAX_UPLOAD_SIZE_BYTES, upload } from './upload.js';
import { errorHandler } from './errors.js';

function buildApp(fileUpload: ReturnType<typeof createUpload>) {
  const app = express();
  app.post('/upload', fileUpload.single('file'), (req, res) => {
    res.json({ receivedBytes: req.file?.size ?? 0 });
  });
  app.use(errorHandler);
  return app;
}

describe('createUpload', () => {
  it('accepts a file comfortably under the configured limit', async () => {
    const app = buildApp(createUpload(1024));
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('1234567890'), 'report.xml'); // 10 bytes
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ receivedBytes: 10 });
  });

  it('rejects a file over the configured limit with a homogeneous 413 error, no stack trace', async () => {
    const app = buildApp(createUpload(10));
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('x'.repeat(2000)), 'report.xml');
    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: { code: 'FILE_TOO_LARGE', message: expect.any(String) as string },
    });
    expect(res.text).not.toMatch(/at .*:\d+:\d+/);
  });

  it('stores the file in memory (buffer), not on disk', async () => {
    const app = express();
    app.post('/upload', createUpload(100).single('file'), (req, res) => {
      res.json({
        hasBuffer: Buffer.isBuffer(req.file?.buffer),
        hasPath: 'path' in (req.file ?? {}),
      });
    });
    app.use(errorHandler);
    const res = await request(app).post('/upload').attach('file', Buffer.from('abc'), 'report.xml');
    expect(res.body).toEqual({ hasBuffer: true, hasPath: false });
  });
});

describe('upload', () => {
  it('is configured with the 50 MB default limit from docs/plan.md §2.7', () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(50 * 1024 * 1024);
    expect(upload).toBeDefined();
  });
});
