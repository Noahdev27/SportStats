import { Router } from 'express';
import { teamController } from '../controllers/team.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../types/common.schema.js';
import { createTeamSchema, listTeamsQuerySchema, updateTeamSchema } from '../types/team.schema.js';

export const teamRouter = Router();

teamRouter
  .route('/')
  .get(validate({ query: listTeamsQuerySchema }), teamController.list)
  .post(validate({ body: createTeamSchema }), teamController.create);

teamRouter
  .route('/:id')
  .get(validate({ params: idParamSchema }), teamController.getById)
  .patch(validate({ params: idParamSchema, body: updateTeamSchema }), teamController.update)
  .delete(validate({ params: idParamSchema }), teamController.remove);
