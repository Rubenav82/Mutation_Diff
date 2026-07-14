import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { compareRuns, parsePitestReport, parseStrykerReport, type NormalizedRun } from 'core';
import { ApiError } from '../errors.js';
import { upload } from '../upload.js';
import { validateBody } from '../validation.js';

const comparisonRequestSchema = z.object({
  tool: z.enum(['pitest', 'stryker']),
  regressionThreshold: z.coerce.number().optional(),
  uncoveredThreshold: z.coerce.number().optional(),
});

function parseReport(tool: 'pitest' | 'stryker', buffer: Buffer, createdAt: string): NormalizedRun {
  const content = buffer.toString('utf-8');
  try {
    return tool === 'pitest'
      ? parsePitestReport(content, { createdAt })
      : parseStrykerReport(content, { createdAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid report file';
    throw new ApiError(422, 'INVALID_REPORT', message);
  }
}

export function createComparisonsRouter(): Router {
  const router = Router();

  router.post(
    '/api/comparisons',
    upload.fields([
      { name: 'baseFile', maxCount: 1 },
      { name: 'headFile', maxCount: 1 },
    ]),
    validateBody(comparisonRequestSchema),
    (req, res) => {
      const files = req.files as
        { baseFile?: Express.Multer.File[]; headFile?: Express.Multer.File[] } | undefined;
      const baseFile = files?.baseFile?.[0];
      const headFile = files?.headFile?.[0];
      if (!baseFile || !headFile) {
        throw new ApiError(422, 'MISSING_FILE', 'Both baseFile and headFile are required');
      }

      const { tool, regressionThreshold, uncoveredThreshold } = req.body as z.infer<
        typeof comparisonRequestSchema
      >;
      const createdAt = new Date().toISOString();

      const baseRun = parseReport(tool, baseFile.buffer, createdAt);
      const headRun = parseReport(tool, headFile.buffer, createdAt);
      const result = compareRuns(baseRun, headRun, {
        ...(regressionThreshold !== undefined ? { regressionThreshold } : {}),
        ...(uncoveredThreshold !== undefined ? { uncoveredThreshold } : {}),
      });

      res.status(200).json({ comparisonId: randomUUID(), result });
    },
  );

  return router;
}
