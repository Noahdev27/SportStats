import { execSync } from 'node:child_process';

/** Applies the migrations to the test database before the suite runs. */
export default function setup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://sportstats:sportstats@localhost:5432/sportstats_test?schema=public';
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'ignore',
  });
}
