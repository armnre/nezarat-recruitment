import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { applicationStatusSchema } from '@nezarat/shared';
import { tenantCtx } from '../../plugins/auth.js';
import type { ApplicationService } from './service.js';

const idParam = z.object({ id: z.string().uuid('شناسه نامعتبر است') });

export function applicationRoutes(app: FastifyInstance, { service }: { service: ApplicationService }) {
  app.get('/api/v1/applications', async (req) => service.list(tenantCtx(req)));
  app.post('/api/v1/applications', async (req) => {
    const { callId } = z.object({ callId: z.string().uuid('فراخوان نامعتبر است') }).parse(req.body);
    return service.create(tenantCtx(req, 'applicant'), callId);
  });
  app.get('/api/v1/applications/:id', async (req) => service.get(tenantCtx(req), idParam.parse(req.params).id));
  app.get('/api/v1/applications/:id/history', async (req) => service.history(tenantCtx(req), idParam.parse(req.params).id));
  app.post('/api/v1/applications/:id/status', async (req) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({ to: applicationStatusSchema, note: z.string().max(2000).optional() }).parse(req.body);
    return service.transition(tenantCtx(req), id, body.to, body.note);
  });
}
