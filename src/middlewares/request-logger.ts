import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

/** Logs one line per request with its status code and duration. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(message);
    else if (res.statusCode >= 400) logger.warn(message);
    else logger.info(message);
  });

  next();
};
