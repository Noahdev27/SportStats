import { z } from 'zod';

// Built-in validation messages in French, consistent with the custom ones.
z.config(z.locales.fr());

export const idSchema = z.coerce
  .number({ error: "L'identifiant doit être un nombre." })
  .int("L'identifiant doit être un entier.")
  .positive("L'identifiant doit être strictement positif.");

export const idParamSchema = z.object({ id: idSchema });
export type IdParam = z.infer<typeof idParamSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sortOrderSchema = z.enum(['asc', 'desc']);

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDateOrDateTime = z.union([z.iso.date(), z.iso.datetime({ offset: true })], {
  error: 'Date invalide : utilisez le format YYYY-MM-DD ou ISO 8601.',
});

/** Lower bound of a date range: `YYYY-MM-DD` means the start of that day (UTC). */
export const dateFromSchema = isoDateOrDateTime.transform((value) => new Date(value));

/** Upper bound of a date range: `YYYY-MM-DD` includes the whole day (UTC). */
export const dateToSchema = isoDateOrDateTime.transform((value) =>
  value.length === 10 ? new Date(new Date(value).getTime() + DAY_MS - 1) : new Date(value),
);

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
