import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env, isTest } from './config/env.js';
import { openApiDocument } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { requestLogger } from './middlewares/request-logger.js';
import { API_PREFIX, apiRouter, healthRouter } from './routes/index.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('query parser', 'simple');

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  if (!isTest) app.use(requestLogger);

  app.get('/', (_req, res) => {
    res.json({ name: 'SportStats API', version: '1.0.0', docs: '/api-docs', health: '/health' });
  });
  app.use('/health', healthRouter);

  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'SportStats API — Docs' }));

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
