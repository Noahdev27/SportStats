import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { api, createMatch, createTeam, resetDatabase } from './helpers.js';

let homeId: number;
let awayId: number;

beforeEach(async () => {
  await resetDatabase();
  homeId = (await createTeam()).id;
  awayId = (await createTeam()).id;
});
afterAll(() => prisma.$disconnect());

const finishedMatch = () => ({
  competition: 'Ligue 1',
  season: '2026/2027',
  matchday: 3,
  kickoffAt: '2026-09-01T19:00:00Z',
  status: 'FINISHED',
  homeTeamId: homeId,
  awayTeamId: awayId,
  homeScore: 2,
  awayScore: 1,
  homeHalfScore: 1,
  awayHalfScore: 1,
});

describe('Matches API', () => {
  it('creates a match with its statistics', async () => {
    const res = await api()
      .post('/api/v1/matches')
      .send({ ...finishedMatch(), statistics: { homeCorners: 7, awayCorners: 3, homePossession: 55, awayPossession: 45 } });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'FINISHED',
      homeScore: 2,
      homeTeam: { id: homeId },
      awayTeam: { id: awayId },
      statistics: { homeCorners: 7, awayCorners: 3, homePossession: 55 },
    });
  });

  it('defaults the status to SCHEDULED', async () => {
    const { status, homeScore, awayScore, homeHalfScore, awayHalfScore, ...scheduled } = finishedMatch();
    const res = await api().post('/api/v1/matches').send(scheduled);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SCHEDULED');
  });

  it.each([
    ['same teams', { awayTeamId: 'HOME' }, 'body.awayTeamId'],
    ['finished without score', { homeScore: null, awayScore: null }, 'body.homeScore'],
    ['scheduled with score', { status: 'SCHEDULED' }, 'body.status'],
    ['half score above final score', { homeHalfScore: 3 }, 'body.homeHalfScore'],
    ['single score', { awayScore: null }, 'body.awayScore'],
    ['invalid date', { kickoffAt: '01/09/2026' }, 'body.kickoffAt'],
  ])('rejects business rule violations: %s', async (_label, override, expectedPath) => {
    const payload = { ...finishedMatch(), ...override };
    if (payload.awayTeamId === 'HOME') payload.awayTeamId = homeId;

    const res = await api().post('/api/v1/matches').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toContain(expectedPath);
  });

  it('rejects inconsistent statistics', async () => {
    const res = await api()
      .post('/api/v1/matches')
      .send({
        ...finishedMatch(),
        statistics: { homeCorners: 1, awayCorners: 1, homePossession: 60, awayPossession: 30, homeShots: 2, homeShotsOnTarget: 5 },
      });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toEqual(
      expect.arrayContaining(['body.statistics.awayPossession', 'body.statistics.homeShotsOnTarget']),
    );
  });

  it('reports unknown teams', async () => {
    const res = await api().post('/api/v1/matches').send({ ...finishedMatch(), awayTeamId: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'body.awayTeamId', message: 'Équipe introuvable (id: 999).' }]);
  });

  it('validates partial updates against the resulting match', async () => {
    const match = await createMatch({ homeTeamId: homeId, awayTeamId: awayId, homeScore: 1, awayScore: 0 });

    // Regression: a PATCH must not reset the status to its creation default.
    const scoreOnly = await api().patch(`/api/v1/matches/${match.id}`).send({ homeScore: 3 });
    expect(scoreOnly.status).toBe(200);
    expect(scoreOnly.body.data).toMatchObject({ status: 'FINISHED', homeScore: 3, awayScore: 0 });

    const invalid = await api().patch(`/api/v1/matches/${match.id}`).send({ status: 'SCHEDULED' });
    expect(invalid.status).toBe(400);

    const swapTeams = await api().patch(`/api/v1/matches/${match.id}`).send({ awayTeamId: homeId });
    expect(swapTeams.status).toBe(400);
  });

  it('finishes a scheduled match', async () => {
    const match = await createMatch({ homeTeamId: homeId, awayTeamId: awayId });
    const res = await api().patch(`/api/v1/matches/${match.id}`).send({ status: 'FINISHED', homeScore: 0, awayScore: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FINISHED');
  });

  it('deletes a match and its statistics', async () => {
    const match = await createMatch({ homeTeamId: homeId, awayTeamId: awayId, homeScore: 1, awayScore: 1, corners: [3, 3] });
    expect((await api().delete(`/api/v1/matches/${match.id}`)).status).toBe(204);
    expect((await api().get(`/api/v1/matches/${match.id}`)).status).toBe(404);
    expect(await prisma.matchStatistics.count()).toBe(0);
  });

  describe('filters', () => {
    beforeEach(async () => {
      const third = (await createTeam()).id;
      await createMatch({ homeTeamId: homeId, awayTeamId: awayId, homeScore: 1, awayScore: 0, kickoffAt: '2026-08-15T19:00:00Z' });
      await createMatch({ homeTeamId: awayId, awayTeamId: third, homeScore: 2, awayScore: 2, kickoffAt: '2026-08-22T23:30:00Z' });
      await createMatch({ homeTeamId: third, awayTeamId: homeId, kickoffAt: '2026-11-01T15:00:00Z' });
      await createMatch({ homeTeamId: third, awayTeamId: homeId, homeScore: 0, awayScore: 1, season: '2025/2026', kickoffAt: '2026-03-01T15:00:00Z' });
    });

    const list = async (query: Record<string, string | number>) => {
      const res = await api().get('/api/v1/matches').query(query);
      expect(res.status).toBe(200);
      return res.body as { data: { kickoffAt: string; status: string }[]; meta: { total: number } };
    };

    it('filters by team (home or away), status and season', async () => {
      expect((await list({ teamId: homeId })).meta.total).toBe(3);
      expect((await list({ homeTeamId: homeId })).meta.total).toBe(1);
      expect((await list({ teamId: homeId, status: 'FINISHED' })).meta.total).toBe(2);
      expect((await list({ status: 'scheduled,finished' })).meta.total).toBe(4);
      expect((await list({ teamId: homeId, season: '2026/2027' })).meta.total).toBe(2);
    });

    it('filters by day and by date range (inclusive end day)', async () => {
      expect((await list({ date: '2026-08-22' })).data.map((m) => m.kickoffAt)).toEqual(['2026-08-22T23:30:00.000Z']);
      expect((await list({ from: '2026-08-15', to: '2026-08-22' })).meta.total).toBe(2);
      expect((await list({ from: '2026-08-16T00:00:00Z' })).meta.total).toBe(2);
    });

    it('sorts by kick-off date and paginates', async () => {
      const asc = await list({ order: 'asc', limit: 2, page: 2 });
      expect(asc.data.map((m) => m.kickoffAt)).toEqual(['2026-08-22T23:30:00.000Z', '2026-11-01T15:00:00.000Z']);
      expect(asc.meta).toMatchObject({ page: 2, limit: 2, total: 4, totalPages: 2 });
    });

    it('rejects invalid filters', async () => {
      const res = await api().get('/api/v1/matches').query({ status: 'OVER', from: '2026-09-01', to: '2026-08-01', limit: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toEqual(
        expect.arrayContaining(['query.status.0', 'query.limit']),
      );
    });
  });
});

describe('Match statistics API', () => {
  it('creates then replaces statistics (PUT semantics)', async () => {
    const match = await createMatch({ homeTeamId: homeId, awayTeamId: awayId, homeScore: 0, awayScore: 0 });
    const url = `/api/v1/matches/${match.id}/statistics`;

    const created = await api().put(url).send({ homeCorners: 4, awayCorners: 6, homeShots: 10 });
    expect(created.status).toBe(201);

    const replaced = await api().put(url).send({ homeCorners: 5, awayCorners: 6 });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data).toMatchObject({ homeCorners: 5, homeShots: null });

    expect((await api().get(url)).body.data.homeCorners).toBe(5);
    expect((await api().delete(url)).status).toBe(204);
    expect((await api().get(url)).status).toBe(404);
  });

  it('refuses statistics for a match that has not been played', async () => {
    const match = await createMatch({ homeTeamId: homeId, awayTeamId: awayId });
    const res = await api().put(`/api/v1/matches/${match.id}/statistics`).send({ homeCorners: 1, awayCorners: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_NOT_PLAYED');
  });

  it('returns 404 for an unknown match', async () => {
    expect((await api().get('/api/v1/matches/999/statistics')).status).toBe(404);
  });
});
