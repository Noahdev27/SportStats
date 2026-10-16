import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { api, createMatch, createTeam, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('Teams API', () => {
  it('creates a team and normalises its short name', async () => {
    const res = await api()
      .post('/api/v1/teams')
      .send({ name: 'Olympique de Marseille', shortName: 'om', country: 'France', foundedYear: 1899 });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/teams/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({ name: 'Olympique de Marseille', shortName: 'OM', foundedYear: 1899 });
  });

  it('rejects invalid payloads and unknown fields', async () => {
    const res = await api().post('/api/v1/teams').send({ name: 'X', country: 'France', extra: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.shortName', 'body']));
  });

  it('returns 409 on duplicate names', async () => {
    await createTeam({ name: 'OGC Nice' });
    const res = await api().post('/api/v1/teams').send({ name: 'OGC Nice', shortName: 'OGCN', country: 'France' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_ALREADY_EXISTS');
  });

  it('lists teams with search, filters and pagination', async () => {
    await createTeam({ name: 'Paris Saint-Germain', country: 'France' });
    await createTeam({ name: 'AS Monaco', country: 'Monaco' });
    await createTeam({ name: 'Paris FC', country: 'France' });

    const search = await api().get('/api/v1/teams').query({ search: 'paris', limit: 1 });
    expect(search.status).toBe(200);
    expect(search.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(search.body.data).toHaveLength(1);

    const byCountry = await api().get('/api/v1/teams').query({ country: 'monaco' });
    expect(byCountry.body.data.map((team: { name: string }) => team.name)).toEqual(['AS Monaco']);
  });

  it('gets, updates and deletes a team', async () => {
    const team = await createTeam();

    const patch = await api().patch(`/api/v1/teams/${team.id}`).send({ stadium: 'Stade Vélodrome' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.stadium).toBe('Stade Vélodrome');

    expect((await api().get(`/api/v1/teams/${team.id}`)).body.data.stadium).toBe('Stade Vélodrome');
    expect((await api().delete(`/api/v1/teams/${team.id}`)).status).toBe(204);
    expect((await api().get(`/api/v1/teams/${team.id}`)).status).toBe(404);
  });

  it('rejects an empty update and a non-numeric id', async () => {
    const team = await createTeam();
    expect((await api().patch(`/api/v1/teams/${team.id}`).send({})).status).toBe(400);
    expect((await api().get('/api/v1/teams/abc')).body.error.details[0].path).toBe('params.id');
  });

  it('refuses to delete a team that has matches', async () => {
    const [home, away] = [await createTeam(), await createTeam()];
    await createMatch({ homeTeamId: home.id, awayTeamId: away.id });

    const res = await api().delete(`/api/v1/teams/${home.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_HAS_MATCHES');
  });
});
