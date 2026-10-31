import argon2 from 'argon2';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { roles, sessions, tenants, userRoles, users } from '../../db/schema.js';
import { audit } from '../../lib/audit.js';
import { AppError, Errors } from '../../lib/errors.js';

const slugRe = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const hostRe = /^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export const tenantInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRe, 'شناسهٔ لاتین فقط حروف کوچک، عدد و خط تیره'),
  name: z.string().trim().min(2, 'نام دانشگاه الزامی است').max(200),
  hostname: z.string().trim().toLowerCase().regex(hostRe, 'دامنه نامعتبر است').nullable().optional(),
  status: z.enum(['active', 'suspended']).default('active'),
  plan: z.enum(['basic', 'pro', 'enterprise']).default('basic'),
  maxApplicants: z.coerce.number().int().min(1, 'حداقل ۱').max(1_000_000),
  maxCalls: z.coerce.number().int().min(1, 'حداقل ۱').max(10_000),
  subscriptionEndsAt: z.coerce.date().nullable().optional(),
});
export type TenantInput = z.infer<typeof tenantInputSchema>;

export const tenantAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email('ایمیل نامعتبر است'),
  fullName: z.string().trim().min(2, 'نام الزامی است').max(120),
  password: z.string().min(12, 'رمز عبور باید حداقل ۱۲ کاراکتر باشد').max(200),
});

export interface PlatformCtx { userId: string; ip?: string }

const uniqueViolation = (e: unknown) => (e as { code?: string }).code === '23505';

export class PlatformService {
  constructor(private db: Db) {}

  /** فهرست دانشگاه‌ها با آمار مصرف. */
  async listTenants() {
    const res = await this.db.execute<Record<string, unknown>>(sql`
      select t.id, t.slug, t.name, t.hostname, t.status, t.plan, t.max_applicants as "maxApplicants", t.max_calls as "maxCalls",
        t.subscription_ends_at as "subscriptionEndsAt", t.created_at as "createdAt",
        (select count(distinct a.applicant_id)::int from applications a where a.tenant_id = t.id and a.deleted_at is null) as "applicants",
        (select count(*)::int from calls c where c.tenant_id = t.id and c.deleted_at is null) as "calls",
        (select count(*)::int from users u where u.tenant_id = t.id and u.deleted_at is null) as "users"
      from tenants t order by t.created_at`);
    return res.rows;
  }

  async saveTenant(ctx: PlatformCtx, id: string | null, input: TenantInput) {
    const values = { ...input, hostname: input.hostname || null, subscriptionEndsAt: input.subscriptionEndsAt ?? null, updatedAt: new Date() };
    try {
      const [row] = id
        ? await this.db.update(tenants).set(values).where(eq(tenants.id, id)).returning()
        : await this.db.insert(tenants).values(values).returning();
      if (!row) throw Errors.notFound('دانشگاه');
      await audit(this.db, { tenantId: row.id, actorId: ctx.userId, action: id ? 'tenant.update' : 'tenant.create', entity: 'tenants', entityId: row.id, after: values, ip: ctx.ip });
      return row;
    } catch (e) {
      if (uniqueViolation(e)) throw Errors.conflict('شناسه یا دامنهٔ این دانشگاه تکراری است');
      throw e;
    }
  }

  async createTenantAdmin(ctx: PlatformCtx, tenantId: string, input: z.infer<typeof tenantAdminSchema>) {
    const [t] = await this.db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId));
    if (!t) throw Errors.notFound('دانشگاه');
    const hash = await argon2.hash(input.password, { type: argon2.argon2id });
    return this.db.transaction(async (tx) => {
      const [dup] = await tx.select({ id: users.id }).from(users).where(and(eq(users.tenantId, tenantId), eq(users.email, input.email), isNull(users.deletedAt)));
      if (dup) throw Errors.conflict('کاربری با این ایمیل در این دانشگاه وجود دارد');
      const [u] = await tx.insert(users).values({ tenantId, email: input.email, fullName: input.fullName, passwordHash: hash }).returning({ id: users.id });
      const [r] = await tx.select().from(roles).where(eq(roles.key, 'university_admin'));
      await tx.insert(userRoles).values({ tenantId, userId: u.id, roleId: r.id });
      await audit(tx, { tenantId, actorId: ctx.userId, action: 'user.create_admin', entity: 'users', entityId: u.id, after: { email: input.email }, ip: ctx.ip });
      return u;
    });
  }

  async listUsers(q: { tenantId?: string; search?: string; limit: number; offset: number }) {
    const s = q.search ? `%${q.search}%` : null;
    return this.db.select({
      id: users.id, fullName: users.fullName, mobile: users.mobile, email: users.email, status: users.status, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
      tenantId: users.tenantId, tenantName: tenants.name,
      roles: sql<string[]>`coalesce((select array_agg(r.key order by r.key) from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = ${users.id}), '{}')`,
    }).from(users).leftJoin(tenants, eq(tenants.id, users.tenantId))
      .where(and(isNull(users.deletedAt), q.tenantId ? eq(users.tenantId, q.tenantId) : undefined,
        s ? or(ilike(users.fullName, s), ilike(users.mobile, s), ilike(users.email, s)) : undefined))
      .orderBy(desc(users.createdAt)).limit(q.limit).offset(q.offset);
  }

  async setUserStatus(ctx: PlatformCtx, id: string, status: 'active' | 'suspended') {
    if (id === ctx.userId) throw new AppError(400, 'VALIDATION', 'نمی‌توانید حساب خودتان را تعلیق کنید');
    const [u] = await this.db.update(users).set({ status, updatedAt: new Date() }).where(and(eq(users.id, id), isNull(users.deletedAt))).returning({ id: users.id, tenantId: users.tenantId });
    if (!u) throw Errors.notFound('کاربر');
    if (status === 'suspended') await this.db.delete(sessions).where(eq(sessions.userId, id));
    await audit(this.db, { tenantId: u.tenantId, actorId: ctx.userId, action: 'user.status', entity: 'users', entityId: id, after: { status }, ip: ctx.ip });
    return { ok: true };
  }

  /** گزارش عملکرد همهٔ دانشگاه‌ها. */
  async performance() {
    const res = await this.db.execute<Record<string, unknown>>(sql`
      select t.id, t.name, t.status, t.plan, t.max_applicants as "maxApplicants", t.max_calls as "maxCalls", t.subscription_ends_at as "subscriptionEndsAt",
        (select count(distinct a.applicant_id)::int from applications a where a.tenant_id = t.id and a.deleted_at is null) as "applicants",
        (select count(*)::int from applications a where a.tenant_id = t.id and a.deleted_at is null and a.status <> 'draft') as "submitted",
        (select count(*)::int from applications a where a.tenant_id = t.id and a.deleted_at is null and a.status = 'accepted') as "accepted",
        (select count(*)::int from calls c where c.tenant_id = t.id and c.deleted_at is null and c.status = 'published') as "activeCalls",
        (select count(*)::int from evaluations e where e.tenant_id = t.id and e.submitted_at is not null) as "evaluations",
        (select count(*)::int from sms_logs s where s.tenant_id = t.id and s.created_at > now() - interval '30 days') as "sms30d",
        (select count(*)::int from sms_logs s where s.tenant_id = t.id and s.status = 'failed' and s.created_at > now() - interval '30 days') as "smsFailed30d",
        (select max(l.created_at) from audit_logs l where l.tenant_id = t.id) as "lastActivity"
      from tenants t order by t.name`);
    return res.rows;
  }
}

export const listUsersQuery = z.object({
  tenantId: z.string().uuid().optional(), search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0),
});
