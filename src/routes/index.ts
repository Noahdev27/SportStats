import { Router } from 'express';
import { prisma } from '../config/database.js';
import { matchRouter } from './match.routes.js';
import { statsRouter } from './stats.routes.js';
import { teamRouter } from './team.routes.js';

export const API_PREFIX = '/api/v1';

/** Mount table of the versioned API (also used to check the OpenAPI coverage). */
export const apiRoutes = {
  '/teams': teamRouter,
  '/matches': matchRouter,
  '/stats': statsRouter,
} as const;

export const apiRouter = Router();
for (const [path, router] of Object.entries(apiRoutes)) apiRouter.use(path, router);

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down', uptime: Math.round(process.uptime()) });
  }
});
