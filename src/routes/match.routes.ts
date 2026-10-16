import { Router } from 'express';
import { matchController } from '../controllers/match.controller.js';
import { statsController } from '../controllers/stats.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../types/common.schema.js';
import {
  createMatchSchema,
  listMatchesQuerySchema,
  matchStatisticsSchema,
  updateMatchSchema,
} from '../types/match.schema.js';

export const matchRouter = Router();

matchRouter
  .route('/')
  .get(validate({ query: listMatchesQuerySchema }), matchController.list)
  .post(validate({ body: createMatchSchema }), matchController.create);

matchRouter
  .route('/:id')
  .get(validate({ params: idParamSchema }), matchController.getById)
  .patch(validate({ params: idParamSchema, body: updateMatchSchema }), matchController.update)
  .delete(validate({ params: idParamSchema }), matchController.remove);

matchRouter
  .route('/:id/statistics')
  .get(validate({ params: idParamSchema }), statsController.getMatchStatistics)
  .put(validate({ params: idParamSchema, body: matchStatisticsSchema }), statsController.upsertMatchStatistics)
  .delete(validate({ params: idParamSchema }), statsController.deleteMatchStatistics);
