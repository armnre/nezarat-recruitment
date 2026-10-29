import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { callInputSchema, memberInputSchema, orgInputSchema } from '@nezarat/shared';
import { tenantCtx } from '../../plugins/auth.js';
import type { AdminService } from './service.js';

const idParam = z.object({ id: z.string().uuid('شناسه نامعتبر است') });
const A = 'university_admin' as const;

export function adminRoutes(app: FastifyInstance, { service }: { service: AdminService }) {
  app.get('/api/v1/admin/stats', async (req) => service.stats(tenantCtx(req, A)));

  app.get('/api/v1/admin/calls', async (req) => service.listCalls(tenantCtx(req, A)));
  app.get('/api/v1/admin/calls/:id', async (req) => service.getCall(tenantCtx(req, A), idParam.parse(req.params).id));
  app.post('/api/v1/admin/calls', async (req) => service.saveCall(tenantCtx(req, A), null, callInputSchema.parse(req.body)));
  app.put('/api/v1/admin/calls/:id', async (req) => service.saveCall(tenantCtx(req, A), idParam.parse(req.params).id, callInputSchema.parse(req.body)));
  app.post('/api/v1/admin/calls/:id/status', async (req) => {
    const { status } = z.object({ status: z.enum(['draft', 'published', 'closed']) }).parse(req.body);
    return service.setCallStatus(tenantCtx(req, A), idParam.parse(req.params).id, status);
  });
  app.delete('/api/v1/admin/calls/:id', async (req) => { await service.deleteCall(tenantCtx(req, A), idParam.parse(req.params).id); return { ok: true }; });

  app.get('/api/v1/org', async (req) => service.org(tenantCtx(req)));
  app.post('/api/v1/admin/org', async (req) => { const b = orgInputSchema.parse(req.body); return service.addOrg(tenantCtx(req, A), b.name, b.facultyId); });
  const kindParam = z.object({ kind: z.enum(['faculty', 'department']), id: z.string().uuid() });
  app.put('/api/v1/admin/org/:kind/:id', async (req) => {
    const p = kindParam.parse(req.params);
    return service.renameOrg(tenantCtx(req, A), p.kind, p.id, orgInputSchema.parse(req.body).name);
  });
  app.delete('/api/v1/admin/org/:kind/:id', async (req) => { const p = kindParam.parse(req.params); await service.removeOrg(tenantCtx(req, A), p.kind, p.id); return { ok: true }; });

  app.get('/api/v1/admin/members', async (req) => service.members(tenantCtx(req, A)));
  app.post('/api/v1/admin/members', async (req) => service.addMember(tenantCtx(req, A), memberInputSchema.parse(req.body)));
  app.patch('/api/v1/admin/members/:id', async (req) => {
    const b = z.object({ active: z.boolean().optional(), role: z.enum(['committee_member', 'committee_chair']).optional(), specialization: z.string().trim().max(200).nullable().optional() }).parse(req.body);
    return service.updateMember(tenantCtx(req, A), idParam.parse(req.params).id, b);
  });

  app.get('/api/v1/admin/reports/applications.csv', async (req, reply) => {
    const { callId } = z.object({ callId: z.string().uuid().optional() }).parse(req.query);
    const csv = await service.exportCsv(tenantCtx(req, A), callId);
    return reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="applications.csv"').header('Cache-Control', 'no-store').send(csv);
  });
  app.get('/api/v1/admin/audit', async (req) => {
    const q = z.object({ entity: z.string().max(60).optional(), limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    return service.auditLog(tenantCtx(req, A), q);
  });
}
