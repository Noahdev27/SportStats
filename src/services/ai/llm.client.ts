import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../utils/logger.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletion {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

/** Subset of the OpenAI-compatible `chat/completions` response that we rely on. */
const completionResponseSchema = z.object({
  model: z.string(),
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
  usage: z
    .object({ prompt_tokens: z.number(), completion_tokens: z.number(), total_tokens: z.number() })
    .optional(),
});

export const notConfiguredError = () =>
  new AppError(503, 'AI_NOT_CONFIGURED', "L'IA n'est pas configurée : définissez AI_API_KEY (clé Groq).");

/**
 * Minimal client for an OpenAI-compatible `chat/completions` API, Groq by default
 * (https://api.groq.com/openai/v1). Any compatible provider works by changing
 * AI_BASE_URL / AI_MODEL / AI_API_KEY. Uses the native `fetch`, no SDK required.
 */
export const llmClient = {
  isConfigured: () => Boolean(env.AI_API_KEY),

  async chat(messages: ChatMessage[], options: { temperature?: number } = {}): Promise<ChatCompletion> {
    if (!env.AI_API_KEY) throw notConfiguredError();

    let response: Response;
    try {
      response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.AI_MODEL,
          messages,
          temperature: options.temperature ?? 0.3,
          // Reasoning models (e.g. gpt-oss): a low effort saves tokens, hence free-tier quota.
          ...(env.AI_REASONING_EFFORT !== 'none' && { reasoning_effort: env.AI_REASONING_EFFORT }),
        }),
        signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new AppError(504, 'AI_TIMEOUT', "Le service d'IA n'a pas répondu dans le délai imparti.");
      }
      logger.error('AI request failed', error);
      throw new AppError(502, 'AI_UPSTREAM_ERROR', "Impossible de joindre le service d'IA.");
    }

    if (!response.ok) {
      // Never forward the upstream body verbatim: it may echo request details.
      logger.error(`AI API responded ${response.status}`, await response.text().catch(() => ''));
      if (response.status === 429) {
        throw new AppError(429, 'AI_RATE_LIMITED', "Limite d'utilisation de l'IA atteinte (quota gratuit Groq), réessayez plus tard.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppError(502, 'AI_AUTH_ERROR', "Clé API invalide ou sans accès au modèle configuré.");
      }
      throw new AppError(502, 'AI_UPSTREAM_ERROR', `Le service d'IA a renvoyé une erreur (${response.status}).`);
    }

    const parsed = completionResponseSchema.safeParse(await response.json().catch(() => null));
    const content = parsed.success ? parsed.data.choices[0]?.message.content?.trim() : undefined;
    if (!parsed.success || !content) {
      throw new AppError(502, 'AI_UPSTREAM_ERROR', "Réponse inattendue du service d'IA.");
    }

    const { usage } = parsed.data;
    return {
      content,
      model: parsed.data.model,
      usage: usage
        ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens }
        : null,
    };
  },
};
