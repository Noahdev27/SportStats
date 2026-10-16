import { z } from 'zod';
import { MatchStatus } from '../generated/prisma/enums.js';
import type { ErrorDetail } from '../utils/app-error.js';
import { idSchema, dateFromSchema, dateToSchema, paginationQuerySchema, sortOrderSchema } from './common.schema.js';

export const matchStatusSchema = z.enum(MatchStatus);

const count = (max: number) => z.number().int().min(0).max(max);

export const matchStatisticsSchema = z
  .strictObject({
    homeCorners: count(40),
    awayCorners: count(40),
    homeShots: count(80).nullish(),
    awayShots: count(80).nullish(),
    homeShotsOnTarget: count(80).nullish(),
    awayShotsOnTarget: count(80).nullish(),
    homePossession: count(100).nullish(),
    awayPossession: count(100).nullish(),
    homeFouls: count(60).nullish(),
    awayFouls: count(60).nullish(),
    homeYellowCards: count(15).nullish(),
    awayYellowCards: count(15).nullish(),
    homeRedCards: count(5).nullish(),
    awayRedCards: count(5).nullish(),
  })
  .superRefine((stats, ctx) => {
    if (stats.homePossession != null && stats.awayPossession != null) {
      if (stats.homePossession + stats.awayPossession !== 100) {
        ctx.addIssue({
          code: 'custom',
          path: ['awayPossession'],
          message: 'La somme des possessions domicile/extérieur doit être égale à 100.',
        });
      }
    }
    for (const side of ['home', 'away'] as const) {
      const shots = stats[`${side}Shots`];
      const onTarget = stats[`${side}ShotsOnTarget`];
      if (shots != null && onTarget != null && onTarget > shots) {
        ctx.addIssue({
          code: 'custom',
          path: [`${side}ShotsOnTarget`],
          message: 'Les tirs cadrés ne peuvent pas dépasser le nombre de tirs.',
        });
      }
    }
  });

const matchBaseSchema = z.strictObject({
  competition: z.string().trim().min(2).max(80),
  season: z.string().regex(/^\d{4}(\/\d{4})?$/, 'Format de saison attendu : YYYY ou YYYY/YYYY.'),
  matchday: z.number().int().min(1).max(60).nullish(),
  kickoffAt: z.iso
    .datetime({ offset: true, error: 'Date-heure ISO 8601 attendue (ex. 2026-08-16T19:00:00Z).' })
    .transform((value) => new Date(value)),
  venue: z.string().trim().min(1).max(120).nullish(),
  status: matchStatusSchema,
  homeTeamId: idSchema,
  awayTeamId: idSchema,
  homeScore: count(30).nullish(),
  awayScore: count(30).nullish(),
  homeHalfScore: count(30).nullish(),
  awayHalfScore: count(30).nullish(),
});

/** Fields that drive the cross-field business rules of a match. */
export interface MatchConsistencyState {
  status: MatchStatus;
  homeTeamId: number;
  awayTeamId: number;
  homeScore?: number | null;
  awayScore?: number | null;
  homeHalfScore?: number | null;
  awayHalfScore?: number | null;
  hasStatistics?: boolean;
}

const STATUSES_WITHOUT_SCORE: MatchStatus[] = ['SCHEDULED', 'POSTPONED', 'CANCELLED'];

/**
 * Business rules shared by creation (Zod refinement) and partial updates (checked
 * against the merged state in the service layer). Returns the list of violations.
 */
export const checkMatchConsistency = (match: MatchConsistencyState): ErrorDetail[] => {
  const issues: ErrorDetail[] = [];
  const hasScore = match.homeScore != null || match.awayScore != null;
  const hasHalfScore = match.homeHalfScore != null || match.awayHalfScore != null;

  if (match.homeTeamId === match.awayTeamId) {
    issues.push({ path: 'awayTeamId', message: "L'équipe à l'extérieur doit être différente de l'équipe à domicile." });
  }
  if ((match.homeScore == null) !== (match.awayScore == null)) {
    issues.push({ path: 'awayScore', message: 'homeScore et awayScore doivent être renseignés ensemble.' });
  }
  if ((match.homeHalfScore == null) !== (match.awayHalfScore == null)) {
    issues.push({ path: 'awayHalfScore', message: 'homeHalfScore et awayHalfScore doivent être renseignés ensemble.' });
  }
  if (match.status === 'FINISHED' && (match.homeScore == null || match.awayScore == null)) {
    issues.push({ path: 'homeScore', message: 'Un match terminé (FINISHED) doit avoir un score.' });
  }
  if (STATUSES_WITHOUT_SCORE.includes(match.status) && (hasScore || hasHalfScore)) {
    issues.push({ path: 'status', message: `Un match ${match.status} ne peut pas avoir de score.` });
  }
  if (STATUSES_WITHOUT_SCORE.includes(match.status) && match.hasStatistics) {
    issues.push({ path: 'statistics', message: `Un match ${match.status} ne peut pas avoir de statistiques.` });
  }
  if (hasHalfScore && !hasScore) {
    issues.push({ path: 'homeScore', message: 'Le score à la mi-temps nécessite un score final.' });
  }
  if (
    match.homeHalfScore != null &&
    match.homeScore != null &&
    match.awayHalfScore != null &&
    match.awayScore != null &&
    (match.homeHalfScore > match.homeScore || match.awayHalfScore > match.awayScore)
  ) {
    issues.push({ path: 'homeHalfScore', message: 'Le score à la mi-temps ne peut pas dépasser le score final.' });
  }
  return issues;
};

// The default status lives on the creation schema only: Zod applies defaults even
// inside `.partial()`, which would silently reset the status on every PATCH.
export const createMatchSchema = matchBaseSchema
  .extend({ status: matchStatusSchema.default('SCHEDULED'), statistics: matchStatisticsSchema.optional() })
  .superRefine((match, ctx) => {
    for (const issue of checkMatchConsistency({ ...match, hasStatistics: match.statistics !== undefined })) {
      ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    }
  });

export const updateMatchSchema = matchBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Au moins un champ doit être fourni.');

/** Comma-separated list of statuses, e.g. `?status=FINISHED,LIVE`. */
const statusListSchema = z
  .string()
  .transform((value) => value.split(',').map((status) => status.trim().toUpperCase()))
  .pipe(z.array(matchStatusSchema).min(1));

export const listMatchesQuerySchema = paginationQuerySchema
  .extend({
    teamId: idSchema.optional(),
    homeTeamId: idSchema.optional(),
    awayTeamId: idSchema.optional(),
    status: statusListSchema.optional(),
    date: z.iso.date('Format attendu : YYYY-MM-DD.').optional(),
    from: dateFromSchema.optional(),
    to: dateToSchema.optional(),
    competition: z.string().trim().min(1).max(80).optional(),
    season: z.string().trim().min(4).max(9).optional(),
    matchday: z.coerce.number().int().min(1).max(60).optional(),
    order: sortOrderSchema.default('desc'),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ['to'],
    message: '`to` doit être postérieur ou égal à `from`.',
  });

export type MatchStatisticsInput = z.infer<typeof matchStatisticsSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
