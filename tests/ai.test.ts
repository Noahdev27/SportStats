import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { api, createMatch, createTeam, resetDatabase } from './helpers.js';

let home: number;
let away: number;
let upcomingId: number;
let finishedId: number;

interface SentRequest {
  url: string;
  headers: Record<string, string>;
  body: { model: string; reasoning_effort?: string; messages: { role: string; content: string }[] };
}

/** Replaces `fetch` with a fake chat-completions endpoint and records what was sent to it. */
const mockLlm = (reply: { status?: number; body?: unknown } = {}) => {
  const sent: SentRequest[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    sent.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    const body = reply.body ?? {
      model: 'test-model',
      choices: [{ message: { role: 'assistant', content: '## Analyse\nPSG favori.' } }],
      usage: { prompt_tokens: 900, completion_tokens: 120, total_tokens: 1020 },
    };
    return new Response(JSON.stringify(body), { status: reply.status ?? 200 });
  });
  return sent;
};

const userPrompt = (request: SentRequest) => request.body.messages.find((m) => m.role === 'user')!.content;

beforeAll(async () => {
  await resetDatabase();
  home = (await createTeam({ name: 'Paris Saint-Germain', shortName: 'PSG' })).id;
  away = (await createTeam({ name: 'Olympique de Marseille', shortName: 'OM' })).id;
  finishedId = (await createMatch({ homeTeamId: home, awayTeamId: away, homeScore: 3, awayScore: 1, corners: [8, 2], kickoffAt: '2026-09-01T19:00:00Z' })).id;
  await createMatch({ homeTeamId: away, awayTeamId: home, homeScore: 0, awayScore: 0, corners: [5, 5], kickoffAt: '2026-09-15T19:00:00Z' });
  upcomingId = (await createMatch({ homeTeamId: home, awayTeamId: away, kickoffAt: '2026-12-01T20:00:00Z' })).id;
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

describe('GET /api/v1/ai/matches/:id/preview', () => {
  it('sends the computed statistics to the model and returns its analysis', async () => {
    const sent = mockLlm();
    const res = await api().get(`/api/v1/ai/matches/${upcomingId}/preview`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      analysis: '## Analyse\nPSG favori.',
      model: 'test-model',
      usage: { promptTokens: 900, completionTokens: 120, totalTokens: 1020 },
    });

    expect(sent).toHaveLength(1);
    const [request] = sent as [SentRequest];
    expect(request.url).toBe('https://llm.test/v1/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer test-key');
    expect(request.body.model).toBe('test-model');
    expect(request.body.reasoning_effort).toBe('low');
    expect(request.body.messages[0]).toMatchObject({ role: 'system' });
    expect(userPrompt(request)).toContain('Paris Saint-Germain – Olympique de Marseille');

    const { context } = res.body.data;
    expect(context.homeTeam.seasonAtHome).toMatchObject({ played: 1, wins: 1, goalsFor: 3, corners: { avgFor: 8 } });
    expect(context.awayTeam.seasonAway).toMatchObject({ played: 1, losses: 1 });
    expect(context.headToHead).toEqual([
      { date: '2026-09-15', competition: 'Ligue 1', home: 'Olympique de Marseille', away: 'Paris Saint-Germain', score: '0-0', corners: '5-5' },
      { date: '2026-09-01', competition: 'Ligue 1', home: 'Paris Saint-Germain', away: 'Olympique de Marseille', score: '3-1', corners: '8-2' },
    ]);
    expect(context.leagueAverages).toMatchObject({ matches: 2, goals: { total: 2 } });
    // The prompt carries exactly the data returned in `context`.
    expect(userPrompt(request)).toContain(JSON.stringify(context));
  });

  it('refuses matches that are already played', async () => {
    const sent = mockLlm();
    const res = await api().get(`/api/v1/ai/matches/${finishedId}/preview`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_NOT_UPCOMING');
    expect(sent).toHaveLength(0);
  });

  it('returns 404 for an unknown match', async () => {
    mockLlm();
    expect((await api().get('/api/v1/ai/matches/999/preview')).status).toBe(404);
  });
});

describe('GET /api/v1/ai/teams/:id/summary', () => {
  it('summarises a team from its statistics and last results', async () => {
    const sent = mockLlm();
    const res = await api().get(`/api/v1/ai/teams/${home}/summary`).query({ season: '2026/2027' });

    expect(res.status).toBe(200);
    expect(res.body.data.context).toMatchObject({
      team: { id: home, name: 'Paris Saint-Germain' },
      filters: { season: '2026/2027' },
      overall: { played: 2, wins: 1, draws: 1, points: 4 },
    });
    expect(res.body.data.context.lastResults).toHaveLength(2);
    expect(userPrompt(sent[0]!)).toContain('Rédige un résumé des performances de Paris Saint-Germain');
  });
});

describe('POST /api/v1/ai/ask', () => {
  it('answers from the standings of the latest season by default', async () => {
    const sent = mockLlm();
    const res = await api().post('/api/v1/ai/ask').send({ question: 'Qui est premier ?' });

    expect(res.status).toBe(200);
    const { context } = res.body.data;
    expect(context.filters).toEqual({ season: '2026/2027' });
    expect(context.standings[0]).toMatchObject({ rank: 1, team: { id: home } });
    expect(context.upcomingMatches).toHaveLength(1);
    expect(userPrompt(sent[0]!)).toContain('Question : """Qui est premier ?"""');
  });

  it('validates the question', async () => {
    const sent = mockLlm();
    const res = await api().post('/api/v1/ai/ask').send({ question: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.question');
    expect(sent).toHaveLength(0);
  });

  it('returns 404 when no finished match matches the filters', async () => {
    mockLlm();
    expect((await api().post('/api/v1/ai/ask').send({ question: 'Qui est premier ?', competition: 'Serie A' })).status).toBe(404);
  });
});

describe('AI provider errors', () => {
  it.each([
    [429, 429, 'AI_RATE_LIMITED'],
    [401, 502, 'AI_AUTH_ERROR'],
    [500, 502, 'AI_UPSTREAM_ERROR'],
  ])('maps an upstream %i to %i %s', async (upstream, expected, code) => {
    mockLlm({ status: upstream, body: { error: 'boom' } });
    const res = await api().get(`/api/v1/ai/teams/${home}/summary`);
    expect(res.status).toBe(expected);
    expect(res.body.error.code).toBe(code);
  });

  it('rejects malformed completions', async () => {
    mockLlm({ body: { model: 'test-model', choices: [] } });
    const res = await api().get(`/api/v1/ai/teams/${home}/summary`);
    expect(res.status).toBe(502);
  });

  it('maps a timeout to 504', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    const res = await api().get(`/api/v1/ai/teams/${home}/summary`);
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
  });

  it('answers 503 when no API key is configured, without calling the provider', async () => {
    const sent = mockLlm();
    const key = env.AI_API_KEY;
    env.AI_API_KEY = undefined;
    try {
      const res = await api().post('/api/v1/ai/ask').send({ question: 'Qui est premier ?' });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
      expect(sent).toHaveLength(0);
    } finally {
      env.AI_API_KEY = key;
    }
  });

  it('omits reasoning_effort when set to none', async () => {
    const sent = mockLlm();
    const effort = env.AI_REASONING_EFFORT;
    env.AI_REASONING_EFFORT = 'none';
    try {
      expect((await api().get(`/api/v1/ai/teams/${home}/summary`)).status).toBe(200);
      expect(sent[0]!.body).not.toHaveProperty('reasoning_effort');
    } finally {
      env.AI_REASONING_EFFORT = effort;
    }
  });

  it('exposes the rate limit headers', async () => {
    mockLlm();
    const res = await api().get(`/api/v1/ai/teams/${home}/summary`);
    expect(res.headers['ratelimit-policy']).toContain('q=1000');
  });
});
