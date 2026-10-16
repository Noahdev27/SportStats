import { z } from 'zod';
import { idSchema, dateFromSchema, dateToSchema } from './common.schema.js';

const analyticsFiltersSchema = z.object({
  competition: z.string().trim().min(1).max(80).optional(),
  season: z.string().trim().min(4).max(9).optional(),
  from: dateFromSchema.optional(),
  to: dateToSchema.optional(),
});

const fromBeforeTo = (query: { from?: Date; to?: Date }) => !query.from || !query.to || query.from <= query.to;
const fromBeforeToIssue = { path: ['to'], message: '`to` doit être postérieur ou égal à `from`.' };

export const overviewQuerySchema = analyticsFiltersSchema
  .extend({ teamId: idSchema.optional() })
  .refine(fromBeforeTo, fromBeforeToIssue);

export const teamStatsQuerySchema = analyticsFiltersSchema
  .extend({ last: z.coerce.number().int().min(1).max(100).optional() })
  .refine(fromBeforeTo, fromBeforeToIssue);

export const standingsQuerySchema = analyticsFiltersSchema.refine(fromBeforeTo, fromBeforeToIssue);

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
export type TeamStatsQuery = z.infer<typeof teamStatsQuerySchema>;
export type StandingsQuery = z.infer<typeof standingsQuerySchema>;

export interface SideAverages {
  home: number | null;
  away: number | null;
  total: number | null;
}

export interface OverviewStats {
  filters: Record<string, unknown>;
  matches: number;
  goals: SideAverages & { over25Rate: number | null; over15Rate: number | null; bttsRate: number | null };
  corners: SideAverages & { matchesWithData: number; over95Rate: number | null };
  results: { homeWinRate: number | null; drawRate: number | null; awayWinRate: number | null };
}

export interface TeamSplitStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number | null;
  avgGoalsAgainst: number | null;
  avgTotalGoals: number | null;
  over25Rate: number | null;
  bttsRate: number | null;
  cleanSheetRate: number | null;
  corners: {
    matchesWithData: number;
    avgFor: number | null;
    avgAgainst: number | null;
    avgTotal: number | null;
  };
}

export interface TeamSplits {
  overall: TeamSplitStats;
  home: TeamSplitStats;
  away: TeamSplitStats;
}

export interface TeamSummary {
  id: number;
  name: string;
  shortName: string;
}

export interface TeamStats extends TeamSplits {
  team: TeamSummary;
  filters: Record<string, unknown>;
}

export interface StandingRow extends TeamSplits {
  rank: number;
  team: TeamSummary;
  goalDifference: number;
}

export interface Standings {
  filters: Record<string, unknown>;
  table: StandingRow[];
}
