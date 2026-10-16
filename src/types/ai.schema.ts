import { z } from 'zod';
import { teamStatsQuerySchema } from './stats.schema.js';

export const teamSummaryQuerySchema = teamStatsQuerySchema;

export const askBodySchema = z.strictObject({
  question: z.string().trim().min(3).max(500),
  competition: z.string().trim().min(1).max(80).optional(),
  season: z.string().trim().min(4).max(9).optional(),
});

export type TeamSummaryQuery = z.infer<typeof teamSummaryQuerySchema>;
export type AskInput = z.infer<typeof askBodySchema>;

export interface AiAnswer<TContext> {
  /** Text produced by Grok (Markdown, in French). */
  analysis: string;
  /** Data computed by the API and sent to Grok: the answer must be grounded in it. */
  context: TContext;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  generatedAt: string;
}
