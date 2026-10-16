import type { Request, Response } from 'express';
import { aiService } from '../services/ai.service.js';
import type { AskInput, TeamSummaryQuery } from '../types/ai.schema.js';
import type { IdParam } from '../types/common.schema.js';

// Request data has already been validated and normalised by the `validate` middleware.
export const aiController = {
  async matchPreview(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await aiService.matchPreview(id) });
  },

  async teamSummary(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await aiService.teamSummary(id, req.query as unknown as TeamSummaryQuery) });
  },

  async ask(req: Request, res: Response) {
    res.json({ data: await aiService.ask(req.body as AskInput) });
  },
};
