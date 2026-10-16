import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/config/swagger.js';
import { API_PREFIX, apiRoutes } from '../src/routes/index.js';
import { api } from './helpers.js';

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

const routeLayers = (router: Router) => router.stack as unknown as RouteLayer[];

/** Lists `METHOD /path` for every route registered on the API routers, in OpenAPI path syntax. */
const registeredRoutes = () =>
  Object.entries(apiRoutes).flatMap(([mountPath, router]) =>
    routeLayers(router).flatMap((layer) => {
      if (!layer.route) return [];
      const path = `${API_PREFIX}${mountPath}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');
      return Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${path}`);
    }),
  );

const documentedRoutes = () =>
  Object.entries(openApiDocument.paths).flatMap(([path, item]) =>
    Object.keys(item)
      .filter((key) => ['get', 'post', 'put', 'patch', 'delete'].includes(key))
      .map((method) => `${method.toUpperCase()} ${path}`),
  );

describe('OpenAPI documentation', () => {
  it('documents every API route, and only existing ones', () => {
    const registered = registeredRoutes();
    expect(registered.length).toBeGreaterThan(0);
    expect(documentedRoutes().filter((route) => !route.startsWith('GET /health')).sort()).toEqual(registered.sort());
  });

  it('only references components that exist', () => {
    const serialized = JSON.stringify(openApiDocument);
    const refs = [...serialized.matchAll(/"#\/components\/(\w+)\/(\w+)"/g)];
    const components = openApiDocument.components as Record<string, Record<string, unknown>>;
    for (const [, section, name] of refs) expect(components[section!]?.[name!], `${section}/${name}`).toBeDefined();
  });

  it('serves the raw document and the Swagger UI', async () => {
    const raw = await api().get('/api-docs.json');
    expect(raw.status).toBe(200);
    expect(raw.body.openapi).toBe('3.0.3');

    const ui = await api().get('/api-docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
  });
});
