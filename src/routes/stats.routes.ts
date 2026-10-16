import { Router } from 'express';
import { statsController } from '../controllers/stats.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../types/common.schema.js';
import { overviewQuerySchema, teamStatsQuerySchema } from '../types/stats.schema.js';

export const statsRouter = Router();

statsRouter.get('/overview', validate({ query: overviewQuerySchema }), statsController.getOverview);
statsRouter.get('/teams/:id', validate({ params: idParamSchema, query: teamStatsQuerySchema }), statsController.getTeamStats);
