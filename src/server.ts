import { createApp } from './app.js';
import { prisma } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 SportStats API prête sur http://localhost:${env.PORT}`);
  logger.info(`📚 Documentation Swagger : http://localhost:${env.PORT}/api-docs`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} reçu, arrêt en cours...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force exit if open connections keep the server alive.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
