import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route introuvable : ${req.method} ${req.originalUrl}`));
};

const fromPrismaError = (error: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (error.code) {
    case 'P2002':
      return AppError.conflict('Une ressource avec ces valeurs uniques existe déjà.', 'UNIQUE_CONSTRAINT');
    case 'P2003':
      return AppError.conflict(
        'Opération impossible : la ressource est référencée par (ou référence) une autre ressource.',
        'FOREIGN_KEY_CONSTRAINT',
      );
    case 'P2025':
      return new AppError(404, 'NOT_FOUND', 'Ressource introuvable.');
    default:
      return new AppError(500, 'DATABASE_ERROR', 'Erreur de base de données.');
  }
};

const normalizeError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return AppError.validation(error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) return fromPrismaError(error);

  if (error instanceof Prisma.PrismaClientValidationError) {
    return AppError.badRequest('Requête invalide pour la base de données.');
  }

  // Errors raised by body-parser (malformed JSON, payload too large, ...).
  if (typeof error === 'object' && error !== null && 'type' in error && 'status' in error) {
    const { type, status } = error as { type: string; status: number };
    if (type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'Le corps de la requête est un JSON invalide.');
    if (type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Le corps de la requête est trop volumineux.');
    if (status >= 400 && status < 500) return new AppError(status, 'BAD_REQUEST', 'Requête invalide.');
  }

  return new AppError(500, 'INTERNAL_SERVER_ERROR', 'Une erreur interne est survenue.');
};

// Express identifies error handlers by their arity: the 4 parameters are required.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalizeError(error);

  const unexpected = !(error instanceof AppError);
  if (appError.statusCode >= 500 && unexpected) {
    logger.error(`${req.method} ${req.originalUrl} failed`, error);
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
      ...(!isProduction && unexpected && appError.statusCode >= 500 && error instanceof Error && { stack: error.stack }),
    },
  });
};
