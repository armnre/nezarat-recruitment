import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { callRequiredDocuments, calls, departments, faculties, scoringCriteria, tenants } from '../../db/schema.js';
import { requirePermission, scoped, type TenantContext } from '../../lib/tenant.js';
import { Errors } from '../../lib/errors.js';

const publicCols = {
  id: calls.id, title: calls.title, description: calls.description, opensAt: calls.opensAt, closesAt: calls.closesAt,
  capacity: calls.capacity, status: calls.status, departmentName: departments.name, facultyName: faculties.name,
};

export class CallsService {
  constructor(private db: Db) {}

  /** Staff list: every call in the tenant. */
  list(ctx: TenantContext) {
    return this.db.select().from(calls).where(scoped(ctx, calls)).orderBy(asc(calls.closesAt));
  }

  async get(ctx: TenantContext, id: string) {
    const [row] = await this.db.select().from(calls).where(scoped(ctx, calls, eq(calls.id, id))).limit(1);
    if (!row) throw Errors.notFound('فراخوان');
    return row;
  }

  async create(ctx: TenantContext, data: { title: string; description?: string; opensAt: Date; closesAt: Date; departmentId?: string }) {
    requirePermission(ctx, 'calls.manage');
    const [row] = await this.db.insert(calls).values({ ...data, tenantId: ctx.tenantId, createdBy: ctx.userId }).returning();
    return row;
  }

  /** Public: active published calls of a tenant (by slug), no auth needed. */
  async listPublic(tenantSlug: string) {
    const [t] = await this.db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
    if (!t || t.status !== 'active') throw Errors.notFound('دانشگاه');
    const now = new Date();
    return this.db.select(publicCols).from(calls)
      .leftJoin(departments, eq(departments.id, calls.departmentId))
      .leftJoin(faculties, eq(faculties.id, departments.facultyId))
      .where(and(eq(calls.tenantId, t.id), eq(calls.status, 'published'), isNull(calls.deletedAt), lte(calls.opensAt, now), gte(calls.closesAt, now)))
      .orderBy(desc(calls.opensAt));
  }

  /** Detail for a signed-in tenant user: published (or any for staff) + required docs + criteria. */
  async detail(ctx: TenantContext, id: string) {
    const [call] = await this.db.select(publicCols).from(calls)
      .leftJoin(departments, eq(departments.id, calls.departmentId))
      .leftJoin(faculties, eq(faculties.id, departments.facultyId))
      .where(scoped(ctx, calls, eq(calls.id, id))).limit(1);
    if (!call || (call.status !== 'published' && !ctx.permissions.includes('calls.manage'))) throw Errors.notFound('فراخوان');
    const [docs, criteria] = await Promise.all([
      this.db.select().from(callRequiredDocuments).where(and(eq(callRequiredDocuments.tenantId, ctx.tenantId), eq(callRequiredDocuments.callId, id))),
      this.db.select().from(scoringCriteria).where(and(eq(scoringCriteria.tenantId, ctx.tenantId), eq(scoringCriteria.callId, id))).orderBy(asc(scoringCriteria.sortOrder)),
    ]);
    return { ...call, requiredDocuments: docs, criteria };
  }
}
