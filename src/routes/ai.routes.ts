import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { aiRateLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import { askBodySchema, teamSummaryQuerySchema } from '../types/ai.schema.js';
import { idParamSchema } from '../types/common.schema.js';

export const aiRouter = Router();

aiRouter.use(aiRateLimiter);

aiRouter.get('/matches/:id/preview', validate({ params: idParamSchema }), aiController.matchPreview);
aiRouter.get(
  '/teams/:id/summary',
  validate({ params: idParamSchema, query: teamSummaryQuerySchema }),
  aiController.teamSummary,
);
aiRouter.post('/ask', validate({ body: askBodySchema }), aiController.ask);
