import type { Request, Response } from 'express';
import { statsService } from '../services/stats.service.js';
import type { IdParam } from '../types/common.schema.js';
import type { MatchStatisticsInput } from '../types/match.schema.js';
import type { OverviewQuery, StandingsQuery, TeamStatsQuery } from '../types/stats.schema.js';

// Request data has already been validated and normalised by the `validate` middleware.
export const statsController = {
  async getMatchStatistics(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await statsService.getMatchStatistics(id) });
  },

  async upsertMatchStatistics(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    const { statistics, created } = await statsService.upsertMatchStatistics(id, req.body as MatchStatisticsInput);
    res.status(created ? 201 : 200).json({ data: statistics });
  },

  async deleteMatchStatistics(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    await statsService.deleteMatchStatistics(id);
    res.status(204).end();
  },

  async getOverview(req: Request, res: Response) {
    res.json({ data: await statsService.getOverview(req.query as unknown as OverviewQuery) });
  },

  async getStandings(req: Request, res: Response) {
    res.json({ data: await statsService.getStandings(req.query as unknown as StandingsQuery) });
  },

  async getTeamStats(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    res.json({ data: await statsService.getTeamStats(id, req.query as unknown as TeamStatsQuery) });
  },
};
