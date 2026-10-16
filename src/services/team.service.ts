import { prisma } from '../config/database.js';
import { Prisma, type Team } from '../generated/prisma/client.js';
import type { Paginated } from '../types/common.schema.js';
import type { CreateTeamInput, ListTeamsQuery, UpdateTeamInput } from '../types/team.schema.js';
import { AppError } from '../utils/app-error.js';
import { buildPaginationMeta, toSkipTake } from '../utils/pagination.js';

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const duplicateNameError = (name: string) =>
  AppError.conflict(`Une équipe nommée "${name}" existe déjà.`, 'TEAM_ALREADY_EXISTS');

export const teamService = {
  async list(query: ListTeamsQuery): Promise<Paginated<Team>> {
    const where: Prisma.TeamWhereInput = {
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { shortName: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.country && { country: { equals: query.country, mode: 'insensitive' } }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.team.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.order }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      prisma.team.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async getById(id: number): Promise<Team> {
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw AppError.notFound('Équipe', id);
    return team;
  },

  async create(input: CreateTeamInput): Promise<Team> {
    try {
      return await prisma.team.create({ data: input });
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateNameError(input.name);
      throw error;
    }
  },

  async update(id: number, input: UpdateTeamInput): Promise<Team> {
    await this.getById(id);
    try {
      return await prisma.team.update({ where: { id }, data: input });
    } catch (error) {
      if (isUniqueViolation(error) && input.name) throw duplicateNameError(input.name);
      throw error;
    }
  },

  async remove(id: number): Promise<void> {
    await this.getById(id);
    const matchCount = await prisma.match.count({ where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] } });
    if (matchCount > 0) {
      throw AppError.conflict(
        `Impossible de supprimer l'équipe : elle est associée à ${matchCount} match(s).`,
        'TEAM_HAS_MATCHES',
      );
    }
    await prisma.team.delete({ where: { id } });
  },
};
