import { z } from 'zod';
import { paginationQuerySchema, sortOrderSchema } from './common.schema.js';

const currentYear = new Date().getUTCFullYear();

export const createTeamSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  shortName: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2).max(60),
  city: z.string().trim().min(1).max(80).nullish(),
  stadium: z.string().trim().min(1).max(120).nullish(),
  foundedYear: z.number().int().min(1850).max(currentYear).nullish(),
});

export const updateTeamSchema = createTeamSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Au moins un champ doit être fourni.');

export const listTeamsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  country: z.string().trim().min(1).max(60).optional(),
  sortBy: z.enum(['name', 'foundedYear', 'createdAt']).default('name'),
  order: sortOrderSchema.default('asc'),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
