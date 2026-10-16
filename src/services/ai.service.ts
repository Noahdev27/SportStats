import { prisma } from '../config/database.js';
import type { AiAnswer, AskInput, TeamSummaryQuery } from '../types/ai.schema.js';
import { AppError } from '../utils/app-error.js';
import { grokClient, type ChatCompletion } from './ai/grok.client.js';
import { askPrompt, matchPreviewPrompt, SYSTEM_PROMPT, teamSummaryPrompt } from './ai/prompts.js';
import { matchService } from './match.service.js';
import { statsService } from './stats.service.js';

const teamSummary = { select: { id: true, name: true, shortName: true } } as const;

/** Compact match line for prompts: fewer tokens than the full API payload. */
const compactMatch = (match: {
  kickoffAt: Date;
  competition: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  homeScore: number | null;
  awayScore: number | null;
  statistics?: { homeCorners: number; awayCorners: number } | null;
}) => ({
  date: match.kickoffAt.toISOString().slice(0, 10),
  competition: match.competition,
  home: match.homeTeam.name,
  away: match.awayTeam.name,
  ...(match.homeScore !== null && { score: `${match.homeScore}-${match.awayScore}` }),
  ...(match.statistics && { corners: `${match.statistics.homeCorners}-${match.statistics.awayCorners}` }),
});

const generate = async <TContext>(prompt: string, context: TContext): Promise<AiAnswer<TContext>> => {
  const completion: ChatCompletion = await grokClient.chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);
  return {
    analysis: completion.content,
    context,
    model: completion.model,
    usage: completion.usage,
    generatedAt: new Date().toISOString(),
  };
};

/** Fails fast (before computing anything) when no API key is configured. */
const assertConfigured = () => {
  if (!grokClient.isConfigured()) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', "L'IA n'est pas configurée : définissez XAI_API_KEY.");
  }
};

export const aiService = {
  /** Pre-match analysis built from both teams' form, venue splits, head-to-head and league averages. */
  async matchPreview(matchId: number) {
    assertConfigured();
    const match = await matchService.getById(matchId);
    if (match.status === 'FINISHED' || match.status === 'CANCELLED') {
      throw AppError.conflict(
        `L'analyse d'avant-match n'est pas disponible pour un match au statut ${match.status}.`,
        'MATCH_NOT_UPCOMING',
      );
    }

    // Only data available before kick-off is used.
    const before = new Date(match.kickoffAt.getTime() - 1);
    const seasonFilters = { competition: match.competition, season: match.season, to: before };

    const [homeSeason, awaySeason, homeForm, awayForm, league, headToHead] = await Promise.all([
      statsService.getTeamStats(match.homeTeamId, seasonFilters),
      statsService.getTeamStats(match.awayTeamId, seasonFilters),
      statsService.getTeamStats(match.homeTeamId, { to: before, last: 5 }),
      statsService.getTeamStats(match.awayTeamId, { to: before, last: 5 }),
      statsService.getOverview(seasonFilters),
      prisma.match.findMany({
        where: {
          status: 'FINISHED',
          kickoffAt: { lt: match.kickoffAt },
          OR: [
            { homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId },
            { homeTeamId: match.awayTeamId, awayTeamId: match.homeTeamId },
          ],
        },
        include: { homeTeam: teamSummary, awayTeam: teamSummary, statistics: true },
        orderBy: { kickoffAt: 'desc' },
        take: 5,
      }),
    ]);

    const context = {
      match: {
        id: match.id,
        competition: match.competition,
        season: match.season,
        matchday: match.matchday,
        kickoffAt: match.kickoffAt.toISOString(),
        status: match.status,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
      homeTeam: { seasonAtHome: homeSeason.home, seasonOverall: homeSeason.overall, last5: homeForm.overall },
      awayTeam: { seasonAway: awaySeason.away, seasonOverall: awaySeason.overall, last5: awayForm.overall },
      headToHead: headToHead.map(compactMatch),
      leagueAverages: { matches: league.matches, goals: league.goals, corners: league.corners, results: league.results },
    };

    const title = `${match.homeTeam.name} – ${match.awayTeam.name} (${match.competition} ${match.season}, coup d'envoi ${context.match.kickoffAt})`;
    return generate(matchPreviewPrompt(title, context), context);
  },

  /** Written summary of a team's performance (same filters as /stats/teams/:id). */
  async teamSummary(teamId: number, query: TeamSummaryQuery) {
    assertConfigured();
    const stats = await statsService.getTeamStats(teamId, query);
    const recent = await matchService.list({
      teamId,
      status: ['FINISHED'],
      competition: query.competition,
      season: query.season,
      from: query.from,
      to: query.to,
      order: 'desc',
      page: 1,
      limit: Math.min(query.last ?? 5, 5),
    });

    const context = {
      team: stats.team,
      filters: stats.filters,
      overall: stats.overall,
      home: stats.home,
      away: stats.away,
      lastResults: recent.data.map(compactMatch),
    };
    return generate(teamSummaryPrompt(stats.team.name, context), context);
  },

  /** Natural-language question answered from the standings, league averages and recent/upcoming matches. */
  async ask(input: AskInput) {
    assertConfigured();
    const season = input.season ?? (await this.latestSeason(input.competition));
    if (!season) throw new AppError(404, 'NOT_FOUND', 'Aucun match terminé ne correspond aux filtres.');

    const filters = { season, competition: input.competition };
    const competitionFilter = input.competition
      ? { competition: { equals: input.competition, mode: 'insensitive' as const } }
      : {};

    const [standings, overview, recent, upcoming] = await Promise.all([
      statsService.getStandings(filters),
      statsService.getOverview(filters),
      prisma.match.findMany({
        where: { status: 'FINISHED', season, ...competitionFilter },
        include: { homeTeam: teamSummary, awayTeam: teamSummary, statistics: true },
        orderBy: { kickoffAt: 'desc' },
        take: 15,
      }),
      prisma.match.findMany({
        where: { status: 'SCHEDULED', season, ...competitionFilter },
        include: { homeTeam: teamSummary, awayTeam: teamSummary },
        orderBy: { kickoffAt: 'asc' },
        take: 10,
      }),
    ]);

    const context = {
      filters: standings.filters,
      standings: standings.table,
      leagueAverages: { matches: overview.matches, goals: overview.goals, corners: overview.corners, results: overview.results },
      recentResults: recent.map(compactMatch),
      upcomingMatches: upcoming.map(compactMatch),
    };
    return generate(askPrompt(input.question, context), context);
  },

  /** Most recent season that has finished matches (optionally within a competition). */
  async latestSeason(competition?: string): Promise<string | undefined> {
    const match = await prisma.match.findFirst({
      where: {
        status: 'FINISHED',
        ...(competition && { competition: { equals: competition, mode: 'insensitive' } }),
      },
      orderBy: { kickoffAt: 'desc' },
      select: { season: true },
    });
    return match?.season;
  },
};
