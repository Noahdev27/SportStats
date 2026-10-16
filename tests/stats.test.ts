import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { api, createMatch, createTeam, resetDatabase } from './helpers.js';

let a: number;
let b: number;
let c: number;

/**
 * Fixture (team A's point of view):
 *   1. A 2-1 B  corners 5-3   (A home win, over 2.5, BTTS)
 *   2. B 0-0 A  corners 4-4   (draw, A clean sheet)
 *   3. A 3-1 C  corners 6-2   (A home win, over 2.5, BTTS)
 *   4. C 1-0 B  no statistics (other season)
 *   + one SCHEDULED match that must be ignored.
 */
beforeAll(async () => {
  await resetDatabase();
  a = (await createTeam({ name: 'Alpha FC' })).id;
  b = (await createTeam({ name: 'Bravo FC' })).id;
  c = (await createTeam({ name: 'Charlie FC' })).id;
  await createMatch({ homeTeamId: a, awayTeamId: b, homeScore: 2, awayScore: 1, corners: [5, 3], kickoffAt: '2026-08-15T19:00:00Z' });
  await createMatch({ homeTeamId: b, awayTeamId: a, homeScore: 0, awayScore: 0, corners: [4, 4], kickoffAt: '2026-08-22T19:00:00Z' });
  await createMatch({ homeTeamId: a, awayTeamId: c, homeScore: 3, awayScore: 1, corners: [6, 2], kickoffAt: '2026-08-29T19:00:00Z' });
  await createMatch({ homeTeamId: c, awayTeamId: b, homeScore: 1, awayScore: 0, season: '2025/2026', kickoffAt: '2026-03-01T19:00:00Z' });
  await createMatch({ homeTeamId: c, awayTeamId: a, kickoffAt: '2026-12-01T19:00:00Z' });
});
afterAll(() => prisma.$disconnect());

describe('GET /api/v1/stats/overview', () => {
  it('aggregates goals, corners, over 2.5 and results for a season', async () => {
    const res = await api().get('/api/v1/stats/overview').query({ season: '2026/2027' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      filters: { season: '2026/2027' },
      matches: 3,
      goals: { home: 1.67, away: 0.67, total: 2.33, over15Rate: 0.6667, over25Rate: 0.6667, bttsRate: 0.6667 },
      corners: { matchesWithData: 3, home: 5, away: 3, total: 8, over95Rate: 0 },
      results: { homeWinRate: 0.6667, drawRate: 0.3333, awayWinRate: 0 },
    });
  });

  it('only counts corners of matches that have statistics', async () => {
    const res = await api().get('/api/v1/stats/overview');
    expect(res.body.data.matches).toBe(4);
    expect(res.body.data.corners).toMatchObject({ matchesWithData: 3, total: 8 });
  });

  it('supports date and team filters', async () => {
    const res = await api().get('/api/v1/stats/overview').query({ from: '2026-08-20', to: '2026-08-29', teamId: c });
    expect(res.body.data.matches).toBe(1);
    expect(res.body.data.goals.total).toBe(4);
  });

  it('returns null averages when nothing matches', async () => {
    const res = await api().get('/api/v1/stats/overview').query({ competition: 'Serie A' });
    expect(res.body.data).toMatchObject({ matches: 0, goals: { total: null, over25Rate: null }, corners: { total: null } });
  });

  it('returns 404 for an unknown team', async () => {
    expect((await api().get('/api/v1/stats/overview').query({ teamId: 999 })).status).toBe(404);
  });
});

describe('GET /api/v1/stats/teams/:id', () => {
  it('splits a team’s performance by venue', async () => {
    const res = await api().get(`/api/v1/stats/teams/${a}`);

    expect(res.status).toBe(200);
    const { team, overall, home, away } = res.body.data;
    expect(team).toEqual({ id: a, name: 'Alpha FC', shortName: expect.any(String) });
    expect(overall).toMatchObject({
      played: 3,
      wins: 2,
      draws: 1,
      losses: 0,
      points: 7,
      goalsFor: 5,
      goalsAgainst: 2,
      avgGoalsFor: 1.67,
      avgGoalsAgainst: 0.67,
      over25Rate: 0.6667,
      bttsRate: 0.6667,
      cleanSheetRate: 0.3333,
      corners: { matchesWithData: 3, avgFor: 5, avgAgainst: 3, avgTotal: 8 },
    });
    expect(home).toMatchObject({ played: 2, wins: 2, avgGoalsFor: 2.5, avgGoalsAgainst: 1, corners: { avgFor: 5.5, avgAgainst: 2.5 } });
    expect(away).toMatchObject({ played: 1, draws: 1, avgGoalsFor: 0, cleanSheetRate: 1, corners: { avgFor: 4, avgAgainst: 4 } });
  });

  it('restricts the analysis to the last N matches', async () => {
    const res = await api().get(`/api/v1/stats/teams/${a}`).query({ last: 2 });
    expect(res.body.data.overall).toMatchObject({ played: 2, goalsFor: 3, goalsAgainst: 1 });
    expect(res.body.data.home.played + res.body.data.away.played).toBe(2);
  });

  it('returns an empty split for a venue without matches', async () => {
    const res = await api().get(`/api/v1/stats/teams/${c}`).query({ season: '2026/2027' });
    expect(res.body.data.home).toMatchObject({ played: 0, avgGoalsFor: null, corners: { matchesWithData: 0 } });
    expect(res.body.data.away).toMatchObject({ played: 1, losses: 1 });
  });

  it('validates parameters', async () => {
    expect((await api().get('/api/v1/stats/teams/999')).status).toBe(404);
    expect((await api().get(`/api/v1/stats/teams/${a}`).query({ last: 0 })).status).toBe(400);
  });
});
