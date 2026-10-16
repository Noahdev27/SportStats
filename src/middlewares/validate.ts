import type { RequestHandler } from 'express';
import type { ZodError, ZodType } from 'zod';
import { AppError, type ErrorDetail } from '../utils/app-error.js';

type RequestPart = 'body' | 'params' | 'query';

export type ValidationSchemas = Partial<Record<RequestPart, ZodType>>;

const toDetails = (part: RequestPart, error: ZodError): ErrorDetail[] =>
  error.issues.map((issue) => ({
    path: [part, ...issue.path].join('.'),
    message: issue.message,
  }));

/**
 * Validates and normalises `req.body`, `req.params` and `req.query` with Zod.
 * The parsed (coerced, defaulted) values replace the raw ones, so controllers
 * receive fully typed data. All failing parts are reported at once.
 */
export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    const details: ErrorDetail[] = [];

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        details.push(...toDetails(part, result.error));
        continue;
      }
      // Express 5 exposes `req.query` as a getter: redefine it instead of assigning.
      Object.defineProperty(req, part, { value: result.data, writable: true, enumerable: true, configurable: true });
    }

    if (details.length > 0) return next(AppError.validation(details));
    next();
  };
