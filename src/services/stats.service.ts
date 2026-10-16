import { prisma } from '../config/database.js';
import { Prisma, type MatchStatistics } from '../generated/prisma/client.js';
import type { MatchStatisticsInput } from '../types/match.schema.js';
import type {
  AnalyticsFilters,
  OverviewQuery,
  OverviewStats,
  TeamSplitStats,
  TeamStats,
  TeamStatsQuery,
} from '../types/stats.schema.js';
import { AppError } from '../utils/app-error.js';

const round = (value: number | null, decimals: number) =>
  value === null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals;
const avg = (value: number | null) => round(value, 2);
const rate = (value: number | null) => round(value, 4);

/** Compares a `timestamp` column (stored in UTC) with a JS Date, independent of the session time zone. */
const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/** Only finished matches with a final score feed the analytics. */
const buildConditions = (filters: AnalyticsFilters, teamId?: number): Prisma.Sql => {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`m.status = 'FINISHED'`,
    Prisma.sql`m.home_score IS NOT NULL AND m.away_score IS NOT NULL`,
  ];
  if (filters.competition) conditions.push(Prisma.sql`lower(m.competition) = lower(${filters.competition})`);
  if (filters.season) conditions.push(Prisma.sql`m.season = ${filters.season}`);
  if (filters.from) conditions.push(Prisma.sql`m.kickoff_at >= ${utc(filters.from)}`);
  if (filters.to) conditions.push(Prisma.sql`m.kickoff_at <= ${utc(filters.to)}`);
  if (teamId !== undefined) conditions.push(Prisma.sql`(m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})`);
  return Prisma.join(conditions, ' AND ');
};

const describeFilters = (filters: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  );

interface OverviewRow {
  matches: number;
  avg_home_goals: number | null;
  avg_away_goals: number | null;
  avg_total_goals: number | null;
  over15_rate: number | null;
  over25_rate: number | null;
  btts_rate: number | null;
  home_win_rate: number | null;
  draw_rate: number | null;
  away_win_rate: number | null;
  corners_matches: number;
  avg_home_corners: number | null;
  avg_away_corners: number | null;
  avg_total_corners: number | null;
  corners_over95_rate: number | null;
}

interface TeamSplitRow {
  is_total: boolean;
  is_home: boolean | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  avg_goals_for: number | null;
  avg_goals_against: number | null;
  avg_total_goals: number | null;
  over25_rate: number | null;
  btts_rate: number | null;
  clean_sheet_rate: number | null;
  corners_matches: number;
  avg_corners_for: number | null;
  avg_corners_against: number | null;
  avg_total_corners: number | null;
}

const emptySplit = (): TeamSplitStats => ({
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  avgGoalsFor: null,
  avgGoalsAgainst: null,
  avgTotalGoals: null,
  over25Rate: null,
  bttsRate: null,
  cleanSheetRate: null,
  corners: { matchesWithData: 0, avgFor: null, avgAgainst: null, avgTotal: null },
});

const toSplit = (row: TeamSplitRow): TeamSplitStats => ({
  played: row.played,
  wins: row.wins,
  draws: row.draws,
  losses: row.losses,
  points: row.wins * 3 + row.draws,
  goalsFor: row.goals_for,
  goalsAgainst: row.goals_against,
  avgGoalsFor: avg(row.avg_goals_for),
  avgGoalsAgainst: avg(row.avg_goals_against),
  avgTotalGoals: avg(row.avg_total_goals),
  over25Rate: rate(row.over25_rate),
  bttsRate: rate(row.btts_rate),
  cleanSheetRate: rate(row.clean_sheet_rate),
  corners: {
    matchesWithData: row.corners_matches,
    avgFor: avg(row.avg_corners_for),
    avgAgainst: avg(row.avg_corners_against),
    avgTotal: avg(row.avg_total_corners),
  },
});

const PLAYED_STATUSES = new Set(['LIVE', 'FINISHED']);

const findMatchOrThrow = async (matchId: number) => {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, status: true } });
  if (!match) throw AppError.notFound('Match', matchId);
  return match;
};

export const statsService = {
  async getMatchStatistics(matchId: number): Promise<MatchStatistics> {
    await findMatchOrThrow(matchId);
    const statistics = await prisma.matchStatistics.findUnique({ where: { matchId } });
    if (!statistics) throw new AppError(404, 'NOT_FOUND', `Aucune statistique enregistrée pour le match ${matchId}.`);
    return statistics;
  },

  /** Creates or replaces the statistics of a match. `created` tells which one happened. */
  async upsertMatchStatistics(
    matchId: number,
    input: MatchStatisticsInput,
  ): Promise<{ statistics: MatchStatistics; created: boolean }> {
    const match = await findMatchOrThrow(matchId);
    if (!PLAYED_STATUSES.has(match.status)) {
      throw AppError.conflict(
        `Impossible d'enregistrer des statistiques pour un match au statut ${match.status}.`,
        'MATCH_NOT_PLAYED',
      );
    }

    const existing = await prisma.matchStatistics.findUnique({ where: { matchId }, select: { matchId: true } });
    // PUT semantics: optional fields missing from the payload are reset to null.
    const data = {
      homeShots: null,
      awayShots: null,
      homeShotsOnTarget: null,
      awayShotsOnTarget: null,
      homePossession: null,
      awayPossession: null,
      homeFouls: null,
      awayFouls: null,
      homeYellowCards: null,
      awayYellowCards: null,
      homeRedCards: null,
      awayRedCards: null,
      ...input,
    };
    const statistics = await prisma.matchStatistics.upsert({
      where: { matchId },
      create: { matchId, ...data },
      update: data,
    });
    return { statistics, created: existing === null };
  },

  async deleteMatchStatistics(matchId: number): Promise<void> {
    await this.getMatchStatistics(matchId);
    await prisma.matchStatistics.delete({ where: { matchId } });
  },

  /** League-wide (or team-scoped) averages: goals, corners, over 2.5, BTTS, 1X2 distribution. */
  async getOverview(query: OverviewQuery): Promise<OverviewStats> {
    if (query.teamId !== undefined) {
      const team = await prisma.team.findUnique({ where: { id: query.teamId }, select: { id: true } });
      if (!team) throw AppError.notFound('Équipe', query.teamId);
    }

    const [row] = await prisma.$queryRaw<OverviewRow[]>`
      SELECT
        COUNT(*)::int                                                         AS matches,
        AVG(m.home_score)::float8                                             AS avg_home_goals,
        AVG(m.away_score)::float8                                             AS avg_away_goals,
        AVG(m.home_score + m.away_score)::float8                              AS avg_total_goals,
        AVG((m.home_score + m.away_score > 1)::int)::float8                   AS over15_rate,
        AVG((m.home_score + m.away_score > 2)::int)::float8                   AS over25_rate,
        AVG((m.home_score > 0 AND m.away_score > 0)::int)::float8             AS btts_rate,
        AVG((m.home_score > m.away_score)::int)::float8                       AS home_win_rate,
        AVG((m.home_score = m.away_score)::int)::float8                       AS draw_rate,
        AVG((m.home_score < m.away_score)::int)::float8                       AS away_win_rate,
        COUNT(s.match_id)::int                                                AS corners_matches,
        AVG(s.home_corners)::float8                                           AS avg_home_corners,
        AVG(s.away_corners)::float8                                           AS avg_away_corners,
        AVG(s.home_corners + s.away_corners)::float8                          AS avg_total_corners,
        AVG((s.home_corners + s.away_corners > 9)::int)::float8               AS corners_over95_rate
      FROM matches m
      LEFT JOIN match_statistics s ON s.match_id = m.id
      WHERE ${buildConditions(query, query.teamId)}
    `;
    if (!row) throw new Error('Aggregate query returned no row');

    return {
      filters: describeFilters(query),
      matches: row.matches,
      goals: {
        home: avg(row.avg_home_goals),
        away: avg(row.avg_away_goals),
        total: avg(row.avg_total_goals),
        over15Rate: rate(row.over15_rate),
        over25Rate: rate(row.over25_rate),
        bttsRate: rate(row.btts_rate),
      },
      corners: {
        matchesWithData: row.corners_matches,
        home: avg(row.avg_home_corners),
        away: avg(row.avg_away_corners),
        total: avg(row.avg_total_corners),
        over95Rate: rate(row.corners_over95_rate),
      },
      results: {
        homeWinRate: rate(row.home_win_rate),
        drawRate: rate(row.draw_rate),
        awayWinRate: rate(row.away_win_rate),
      },
    };
  },

  /** Team performance split by venue (overall / home / away), optionally over its last N matches. */
  async getTeamStats(teamId: number, query: TeamStatsQuery): Promise<TeamStats> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, shortName: true },
    });
    if (!team) throw AppError.notFound('Équipe', teamId);

    const limit = query.last ? Prisma.sql`LIMIT ${query.last}` : Prisma.empty;

    // Each match is projected from the team's point of view (for / against),
    // then ROLLUP produces the home row, the away row and the overall total.
    const rows = await prisma.$queryRaw<TeamSplitRow[]>`
      WITH team_matches AS (
        SELECT
          (m.home_team_id = ${teamId})                                               AS is_home,
          CASE WHEN m.home_team_id = ${teamId} THEN m.home_score ELSE m.away_score END   AS gf,
          CASE WHEN m.home_team_id = ${teamId} THEN m.away_score ELSE m.home_score END   AS ga,
          CASE WHEN m.home_team_id = ${teamId} THEN s.home_corners ELSE s.away_corners END AS cf,
          CASE WHEN m.home_team_id = ${teamId} THEN s.away_corners ELSE s.home_corners END AS ca
        FROM matches m
        LEFT JOIN match_statistics s ON s.match_id = m.id
        WHERE ${buildConditions(query, teamId)}
        ORDER BY m.kickoff_at DESC
        ${limit}
      )
      SELECT
        GROUPING(is_home) = 1                         AS is_total,
        is_home,
        COUNT(*)::int                                 AS played,
        COUNT(*) FILTER (WHERE gf > ga)::int          AS wins,
        COUNT(*) FILTER (WHERE gf = ga)::int          AS draws,
        COUNT(*) FILTER (WHERE gf < ga)::int          AS losses,
        COALESCE(SUM(gf), 0)::int                     AS goals_for,
        COALESCE(SUM(ga), 0)::int                     AS goals_against,
        AVG(gf)::float8                               AS avg_goals_for,
        AVG(ga)::float8                               AS avg_goals_against,
        AVG(gf + ga)::float8                          AS avg_total_goals,
        AVG((gf + ga > 2)::int)::float8               AS over25_rate,
        AVG((gf > 0 AND ga > 0)::int)::float8         AS btts_rate,
        AVG((ga = 0)::int)::float8                    AS clean_sheet_rate,
        COUNT(cf)::int                                AS corners_matches,
        AVG(cf)::float8                               AS avg_corners_for,
        AVG(ca)::float8                               AS avg_corners_against,
        AVG(cf + ca)::float8                          AS avg_total_corners
      FROM team_matches
      GROUP BY ROLLUP (is_home)
    `;

    const pick = (predicate: (row: TeamSplitRow) => boolean) => {
      const row = rows.find(predicate);
      return row && row.played > 0 ? toSplit(row) : emptySplit();
    };

    return {
      team,
      filters: describeFilters(query),
      overall: pick((row) => row.is_total),
      home: pick((row) => !row.is_total && row.is_home === true),
      away: pick((row) => !row.is_total && row.is_home === false),
    };
  },
};
