import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  CORS_ORIGIN: z.string().default('*'),

  // Grok (xAI) — optional: without a key the /ai endpoints answer 503 AI_NOT_CONFIGURED.
  XAI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  XAI_BASE_URL: z.url().default('https://api.x.ai/v1'),
  XAI_MODEL: z.string().trim().min(1).default('grok-3-mini'),
  XAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuration invalide :');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
