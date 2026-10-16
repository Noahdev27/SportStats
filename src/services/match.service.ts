import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Paginated } from '../types/common.schema.js';
import {
  checkMatchConsistency,
  type CreateMatchInput,
  type ListMatchesQuery,
  type UpdateMatchInput,
} from '../types/match.schema.js';
import { AppError, type ErrorDetail } from '../utils/app-error.js';
import { buildPaginationMeta, toSkipTake } from '../utils/pagination.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const teamSummary = { select: { id: true, name: true, shortName: true } } as const;

export const matchInclude = {
  homeTeam: teamSummary,
  awayTeam: teamSummary,
  statistics: true,
} satisfies Prisma.MatchInclude;

export type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

const buildWhere = (query: ListMatchesQuery): Prisma.MatchWhereInput => {
  const and: Prisma.MatchWhereInput[] = [];

  if (query.teamId) and.push({ OR: [{ homeTeamId: query.teamId }, { awayTeamId: query.teamId }] });
  if (query.homeTeamId) and.push({ homeTeamId: query.homeTeamId });
  if (query.awayTeamId) and.push({ awayTeamId: query.awayTeamId });
  if (query.status) and.push({ status: { in: query.status } });
  if (query.competition) and.push({ competition: { equals: query.competition, mode: 'insensitive' } });
  if (query.season) and.push({ season: query.season });
  if (query.matchday) and.push({ matchday: query.matchday });
  if (query.date) {
    const dayStart = new Date(`${query.date}T00:00:00.000Z`);
    and.push({ kickoffAt: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) } });
  }
  if (query.from) and.push({ kickoffAt: { gte: query.from } });
  if (query.to) and.push({ kickoffAt: { lte: query.to } });

  return and.length > 0 ? { AND: and } : {};
};

/** Ensures every referenced team exists, reporting each missing one. */
const assertTeamsExist = async (refs: { path: string; id: number }[]) => {
  const ids = [...new Set(refs.map((ref) => ref.id))];
  const found = await prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const foundIds = new Set(found.map((team) => team.id));
  const missing: ErrorDetail[] = refs
    .filter((ref) => !foundIds.has(ref.id))
    .map((ref) => ({ path: ref.path, message: `Équipe introuvable (id: ${ref.id}).` }));
  if (missing.length > 0) throw AppError.validation(missing, 'Équipe(s) référencée(s) introuvable(s).');
};

export const matchService = {
  async list(query: ListMatchesQuery): Promise<Paginated<MatchWithRelations>> {
    const where = buildWhere(query);

    const [data, total] = await prisma.$transaction([
      prisma.match.findMany({
        where,
        include: matchInclude,
        orderBy: [{ kickoffAt: query.order }, { id: query.order }],
        ...toSkipTake(query),
      }),
      prisma.match.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async getById(id: number): Promise<MatchWithRelations> {
    const match = await prisma.match.findUnique({ where: { id }, include: matchInclude });
    if (!match) throw AppError.notFound('Match', id);
    return match;
  },

  async create(input: CreateMatchInput): Promise<MatchWithRelations> {
    await assertTeamsExist([
      { path: 'body.homeTeamId', id: input.homeTeamId },
      { path: 'body.awayTeamId', id: input.awayTeamId },
    ]);

    const { statistics, ...match } = input;
    return prisma.match.create({
      data: { ...match, ...(statistics && { statistics: { create: statistics } }) },
      include: matchInclude,
    });
  },

  async update(id: number, input: UpdateMatchInput): Promise<MatchWithRelations> {
    const existing = await this.getById(id);

    // Partial updates are validated against the resulting state, not the patch alone.
    const merged = { ...existing, ...input };
    const issues = checkMatchConsistency({ ...merged, hasStatistics: existing.statistics !== null });
    if (issues.length > 0) {
      throw AppError.validation(issues.map((issue) => ({ ...issue, path: `body.${issue.path}` })));
    }

    const teamRefs = [
      ...(input.homeTeamId !== undefined ? [{ path: 'body.homeTeamId', id: input.homeTeamId }] : []),
      ...(input.awayTeamId !== undefined ? [{ path: 'body.awayTeamId', id: input.awayTeamId }] : []),
    ];
    if (teamRefs.length > 0) await assertTeamsExist(teamRefs);

    return prisma.match.update({ where: { id }, data: input, include: matchInclude });
  },

  async remove(id: number): Promise<void> {
    await this.getById(id);
    await prisma.match.delete({ where: { id } });
  },
};
