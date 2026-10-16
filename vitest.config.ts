import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Test files share one database: run them one after the other.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      // The AI provider is never called for real: tests stub `fetch`.
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://llm.test/v1',
      AI_MODEL: 'test-model',
      AI_REASONING_EFFORT: 'low',
      AI_RATE_LIMIT_PER_MINUTE: '1000',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://sportstats:sportstats@localhost:5432/sportstats_test?schema=public',
    },
  },
});
