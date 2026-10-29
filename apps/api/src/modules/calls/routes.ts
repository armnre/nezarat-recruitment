import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tenantCtx } from '../../plugins/auth.js';
import type { CallsService } from './calls.service.js';

export function callRoutes(app: FastifyInstance, { service }: { service: CallsService }) {
  app.get('/api/v1/public/:slug/calls', async (req) => {
    const { slug } = z.object({ slug: z.string().min(1).max(60) }).parse(req.params);
    return service.listPublic(slug);
  });
  app.get('/api/v1/calls/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    return service.detail(tenantCtx(req), id);
  });
}
