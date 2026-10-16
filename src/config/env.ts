import 'dotenv/config';
import { z } from 'zod';

/** `KEY=` in a .env file means "not set". */
const emptyAsUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  CORS_ORIGIN: z.string().default('*'),

  // AI — any OpenAI-compatible API, Groq by default. Optional: without a key the
  // /ai endpoints answer 503 AI_NOT_CONFIGURED.
  AI_API_KEY: emptyAsUndefined(z.string().trim().optional()),
  AI_BASE_URL: z.url().default('https://api.groq.com/openai/v1'),
  AI_MODEL: z.string().trim().min(1).default('openai/gpt-oss-120b'),
  // Sent as `reasoning_effort` (reasoning models such as gpt-oss); `none` omits the parameter.
  AI_REASONING_EFFORT: z.enum(['none', 'low', 'medium', 'high']).default('low'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
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
