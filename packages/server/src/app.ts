import express, { type Express } from 'express';
import { ApiError, errorHandler } from './errors.js';
import { createComparisonsRouter } from './routes/comparisons.js';

export function createApp(): Express {
  const app = express();
  app.use(createComparisonsRouter());

  app.use((req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
  });

  app.use(errorHandler);
  return app;
}
