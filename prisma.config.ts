import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not `env()`: `prisma generate` (postinstall) must work without a database URL.
    url: process.env.DATABASE_URL,
  },
});
