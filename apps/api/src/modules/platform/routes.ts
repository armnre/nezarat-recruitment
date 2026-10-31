import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireSuperAdmin } from '../../plugins/auth.js';
import { listUsersQuery, tenantAdminSchema, tenantInputSchema, type PlatformService } from './service.js';

const idParam = z.object({ id: z.string().uuid('شناسه نامعتبر است') });

export function platformRoutes(app: FastifyInstance, { service }: { service: PlatformService }) {
  const ctx = (req: Parameters<typeof requireSuperAdmin>[0]) => ({ userId: requireSuperAdmin(req).id, ip: req.ip });

  app.get('/api/v1/platform/tenants', async (req) => { requireSuperAdmin(req); return service.listTenants(); });
  app.post('/api/v1/platform/tenants', async (req) => service.saveTenant(ctx(req), null, tenantInputSchema.parse(req.body)));
  app.put('/api/v1/platform/tenants/:id', async (req) => service.saveTenant(ctx(req), idParam.parse(req.params).id, tenantInputSchema.parse(req.body)));
  app.post('/api/v1/platform/tenants/:id/admins', async (req) => service.createTenantAdmin(ctx(req), idParam.parse(req.params).id, tenantAdminSchema.parse(req.body)));
  app.get('/api/v1/platform/users', async (req) => { requireSuperAdmin(req); return service.listUsers(listUsersQuery.parse(req.query)); });
  app.patch('/api/v1/platform/users/:id', async (req) => {
    const { status } = z.object({ status: z.enum(['active', 'suspended']) }).parse(req.body);
    return service.setUserStatus(ctx(req), idParam.parse(req.params).id, status);
  });
  app.get('/api/v1/platform/reports/performance', async (req) => { requireSuperAdmin(req); return service.performance(); });
}
