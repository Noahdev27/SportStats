import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';

export const app = createApp();
export const api = () => request(app);

/** Safety net: the suite truncates tables, never let it touch a non-test database. */
const assertTestDatabase = () => {
  const name = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (!name.includes('test')) throw new Error(`Refusing to reset database "${name}": its name must contain "test".`);
};

export const resetDatabase = async () => {
  assertTestDatabase();
  await prisma.$executeRaw`TRUNCATE TABLE match_statistics, matches, teams RESTART IDENTITY CASCADE`;
};

let teamCounter = 0;

export const createTeam = (overrides: Partial<{ name: string; shortName: string; country: string }> = {}) => {
  teamCounter += 1;
  return prisma.team.create({
    data: { name: `Team ${teamCounter}`, shortName: `T${teamCounter}`, country: 'France', ...overrides },
  });
};

interface MatchFixture {
  homeTeamId: number;
  awayTeamId: number;
  kickoffAt?: string;
  status?: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  homeScore?: number;
  awayScore?: number;
  season?: string;
  competition?: string;
  corners?: [number, number];
}

export const createMatch = ({ corners, kickoffAt = '2026-09-01T19:00:00Z', ...fixture }: MatchFixture) =>
  prisma.match.create({
    data: {
      competition: 'Ligue 1',
      season: '2026/2027',
      status: fixture.homeScore === undefined ? 'SCHEDULED' : 'FINISHED',
      ...fixture,
      kickoffAt: new Date(kickoffAt),
      ...(corners && { statistics: { create: { homeCorners: corners[0], awayCorners: corners[1] } } }),
    },
  });
