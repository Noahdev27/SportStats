import type { Request, Response } from 'express';
import { matchService } from '../services/match.service.js';
import type { IdParam } from '../types/common.schema.js';
import type { CreateMatchInput, ListMatchesQuery, UpdateMatchInput } from '../types/match.schema.js';

// Request data has already been validated and normalised by the `validate` middleware.
export const matchController = {
  async list(req: Request, res: Response) {
    res.json(await matchService.list(req.query as unknown as ListMatchesQuery));
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await matchService.getById(id) });
  },

  async create(req: Request, res: Response) {
    const match = await matchService.create(req.body as CreateMatchInput);
    res.status(201).location(`${req.baseUrl}/${match.id}`).json({ data: match });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await matchService.update(id, req.body as UpdateMatchInput) });
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    await matchService.remove(id);
    res.status(204).end();
  },
};
