import type { Request, Response } from 'express';
import { teamService } from '../services/team.service.js';
import type { IdParam } from '../types/common.schema.js';
import type { CreateTeamInput, ListTeamsQuery, UpdateTeamInput } from '../types/team.schema.js';

// Request data has already been validated and normalised by the `validate` middleware.
export const teamController = {
  async list(req: Request, res: Response) {
    res.json(await teamService.list(req.query as unknown as ListTeamsQuery));
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await teamService.getById(id) });
  },

  async create(req: Request, res: Response) {
    const team = await teamService.create(req.body as CreateTeamInput);
    res.status(201).location(`${req.baseUrl}/${team.id}`).json({ data: team });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await teamService.update(id, req.body as UpdateTeamInput) });
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    await teamService.remove(id);
    res.status(204).end();
  },
};
