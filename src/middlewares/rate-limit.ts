import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

/** Protects the AI endpoints (and the Grok credits) from bursts: N calls per minute per IP. */
export const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.AI_RATE_LIMIT_PER_MINUTE,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', "Trop de requêtes vers l'IA, réessayez dans une minute."));
  },
});
