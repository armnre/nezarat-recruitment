import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assignSchema, evaluationSchema } from '@nezarat/shared';
import { tenantCtx } from '../../plugins/auth.js';
import type { CommitteeService } from './service.js';

const idParam = z.object({ id: z.string().uuid('شناسه نامعتبر است') });
const STAFF = ['committee_member', 'committee_chair', 'university_admin'] as const;

export function committeeRoutes(app: FastifyInstance, { service }: { service: CommitteeService }) {
  app.get('/api/v1/committee/assignments', async (req) => service.myAssignments(tenantCtx(req, ...STAFF)));
  app.get('/api/v1/committee/applications/:id', async (req) => service.dossier(tenantCtx(req, ...STAFF), idParam.parse(req.params).id));
  app.put('/api/v1/committee/assignments/:id/evaluation', async (req) =>
    service.saveEvaluation(tenantCtx(req, ...STAFF), idParam.parse(req.params).id, evaluationSchema.parse(req.body)));

  app.get('/api/v1/committee/members', async (req) => service.listMembers(tenantCtx(req, ...STAFF)));
  app.get('/api/v1/committee/queue', async (req) => service.queue(tenantCtx(req, ...STAFF)));
  app.post('/api/v1/committee/applications/:id/assignments', async (req) => {
    const b = assignSchema.parse(req.body);
    return service.assign(tenantCtx(req, ...STAFF), idParam.parse(req.params).id, b.memberIds, b.dueAt);
  });
  app.delete('/api/v1/committee/assignments/:id', async (req) => {
    await service.unassign(tenantCtx(req, ...STAFF), idParam.parse(req.params).id);
    return { ok: true };
  });
  app.get('/api/v1/committee/applications/:id/summary', async (req) => service.summary(tenantCtx(req, ...STAFF), idParam.parse(req.params).id));
  app.post('/api/v1/committee/applications/:id/finalize', async (req) => {
    const { note } = z.object({ note: z.string().max(2000).optional() }).parse(req.body ?? {});
    return service.finalize(tenantCtx(req, ...STAFF), idParam.parse(req.params).id, note);
  });
}
