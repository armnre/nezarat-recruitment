import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { CallInput, memberInputSchema } from '@nezarat/shared';
import { STATUS_LABELS_FA, type ApplicationStatus } from '@nezarat/shared';
import type { Db } from '../../db/client.js';
import {
  applications, auditLogs, callRequiredDocuments, calls, committeeMembers, departments, documents, faculties,
  roles, scoringCriteria, tenants, userRoles, users,
} from '../../db/schema.js';
import { buildCsv, buildPdf, buildXlsx } from '../../lib/reports.js';
import { assertCallCapacity } from '../../lib/subscription.js';
import { JALALI_MONTHS, isoToJalali } from '@nezarat/shared';

const tehranIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
const jalaliDate = (d: Date | null) => {
  if (!d) return '';
  const j = isoToJalali(tehranIso.format(d));
  return `${j.jd} ${JALALI_MONTHS[j.jm - 1]} ${j.jy}`;
};
import { requirePermission, scoped, type TenantContext } from '../../lib/tenant.js';
import { Errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';


export class AdminService {
  constructor(private db: Db) {}

  // ---------- Dashboard ----------
  async stats(ctx: TenantContext) {
    requirePermission(ctx, 'applications.view_all');
    const byStatus = await this.db.select({ status: applications.status, count: sql<number>`count(*)::int` }).from(applications)
      .where(scoped(ctx, applications)).groupBy(applications.status);
    const [c] = await this.db.select({
      open: sql<number>`count(*) filter (where ${calls.status} = 'published' and ${calls.closesAt} > now())::int`,
      total: sql<number>`count(*)::int`,
    }).from(calls).where(scoped(ctx, calls));
    const [m] = await this.db.select({ count: sql<number>`count(*)::int` }).from(committeeMembers).where(and(eq(committeeMembers.tenantId, ctx.tenantId), eq(committeeMembers.active, true)));
    const recent = await this.db.select({ id: applications.id, status: applications.status, submittedAt: applications.submittedAt, applicantName: users.fullName, callTitle: calls.title })
      .from(applications).innerJoin(users, eq(users.id, applications.applicantId)).innerJoin(calls, eq(calls.id, applications.callId))
      .where(scoped(ctx, applications, ne(applications.status, 'draft'))).orderBy(desc(applications.updatedAt)).limit(8);
    return { byStatus, openCalls: c.open, totalCalls: c.total, activeMembers: m.count, recent };
  }

  // ---------- Calls ----------
  listCalls(ctx: TenantContext) {
    requirePermission(ctx, 'calls.manage');
    return this.db.select({
      id: calls.id, title: calls.title, status: calls.status, opensAt: calls.opensAt, closesAt: calls.closesAt, capacity: calls.capacity,
      departmentName: departments.name,
      applications: sql<number>`(select count(*)::int from applications a where a.call_id = ${calls.id} and a.status <> 'draft' and a.deleted_at is null)`,
    }).from(calls).leftJoin(departments, eq(departments.id, calls.departmentId))
      .where(scoped(ctx, calls)).orderBy(desc(calls.createdAt));
  }

  private async structureLocked(callId: string) {
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(applications)
      .where(and(eq(applications.callId, callId), ne(applications.status, 'draft'), isNull(applications.deletedAt)));
    return r.n > 0;
  }

  async getCall(ctx: TenantContext, id: string) {
    requirePermission(ctx, 'calls.manage');
    const [call] = await this.db.select().from(calls).where(scoped(ctx, calls, eq(calls.id, id)));
    if (!call) throw Errors.notFound('فراخوان');
    const [requiredDocuments, criteria] = await Promise.all([
      this.db.select().from(callRequiredDocuments).where(and(eq(callRequiredDocuments.tenantId, ctx.tenantId), eq(callRequiredDocuments.callId, id))).orderBy(asc(callRequiredDocuments.createdAt)),
      this.db.select().from(scoringCriteria).where(scoped(ctx, scoringCriteria, eq(scoringCriteria.callId, id))).orderBy(asc(scoringCriteria.sortOrder)),
    ]);
    return { ...call, requiredDocuments, criteria, structureLocked: await this.structureLocked(id) };
  }

  private async assertDepartment(ctx: TenantContext, departmentId?: string | null) {
    if (!departmentId) return;
    const [d] = await this.db.select({ id: departments.id }).from(departments).where(scoped(ctx, departments, eq(departments.id, departmentId)));
    if (!d) throw Errors.validation('گروه آموزشی نامعتبر است');
  }

  async saveCall(ctx: TenantContext, id: string | null, input: CallInput) {
    requirePermission(ctx, 'calls.manage');
    if (!id) await assertCallCapacity(this.db, ctx.tenantId);
    await this.assertDepartment(ctx, input.departmentId);
    const locked = id ? await this.structureLocked(id) : false;
    const before = id ? await this.getCall(ctx, id) : null;
    const meta = { title: input.title, description: input.description, departmentId: input.departmentId ?? null, opensAt: input.opensAt, closesAt: input.closesAt, capacity: input.capacity ?? null, workflow: input.workflow };
    const callId = await this.db.transaction(async (tx) => {
      const [row] = id
        ? await tx.update(calls).set(meta).where(and(eq(calls.id, id), eq(calls.tenantId, ctx.tenantId))).returning()
        : await tx.insert(calls).values({ ...meta, tenantId: ctx.tenantId, createdBy: ctx.userId }).returning();
      if (locked) return row.id;
      // required documents: upsert by key, drop removed ones (soft-detach uploaded drafts)
      const existing = await tx.select().from(callRequiredDocuments).where(eq(callRequiredDocuments.callId, row.id));
      for (const d of input.requiredDocuments) {
        await tx.insert(callRequiredDocuments).values({ ...d, tenantId: ctx.tenantId, callId: row.id })
          .onConflictDoUpdate({ target: [callRequiredDocuments.callId, callRequiredDocuments.key], set: { title: d.title, mimeTypes: d.mimeTypes, maxSizeMb: d.maxSizeMb, required: d.required } });
      }
      const removed = existing.filter((e) => !input.requiredDocuments.some((d) => d.key === e.key)).map((e) => e.id);
      if (removed.length) {
        await tx.update(documents).set({ requiredDocumentId: null, deletedAt: new Date() }).where(inArray(documents.requiredDocumentId, removed));
        await tx.delete(callRequiredDocuments).where(inArray(callRequiredDocuments.id, removed));
      }
      await tx.delete(scoringCriteria).where(eq(scoringCriteria.callId, row.id));
      if (input.criteria.length) {
        await tx.insert(scoringCriteria).values(input.criteria.map((c, i) => ({ tenantId: ctx.tenantId, callId: row.id, title: c.title, category: c.category ?? null, maxScore: c.maxScore, weight: String(c.weight), sortOrder: i })));
      }
      await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: id ? 'call.update' : 'call.create', entity: 'calls', entityId: row.id,
        before: before ? { title: before.title, opensAt: before.opensAt, closesAt: before.closesAt } : null, after: { ...meta, docs: input.requiredDocuments.length, criteria: input.criteria.length }, ip: ctx.ip });
      return row.id;
    });
    if (locked) await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'call.update', entity: 'calls', entityId: callId, after: meta, ip: ctx.ip });
    return this.getCall(ctx, callId);
  }

  async setCallStatus(ctx: TenantContext, id: string, status: 'draft' | 'published' | 'closed') {
    const call = await this.getCall(ctx, id);
    if (status === 'published' && !call.criteria.length) throw Errors.validation('پیش از انتشار، معیارهای امتیازدهی را تعریف کنید');
    if (status === 'draft' && call.structureLocked) throw Errors.validation('فراخوانی که درخواست دریافت کرده قابل بازگشت به پیش‌نویس نیست');
    await this.db.update(calls).set({ status }).where(and(eq(calls.id, id), eq(calls.tenantId, ctx.tenantId)));
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'call.status', entity: 'calls', entityId: id, before: { status: call.status }, after: { status }, ip: ctx.ip });
    return { ok: true };
  }

  async deleteCall(ctx: TenantContext, id: string) {
    const call = await this.getCall(ctx, id);
    if (call.structureLocked) throw Errors.validation('فراخوانی که درخواست دریافت کرده قابل حذف نیست؛ آن را ببندید');
    await this.db.update(calls).set({ deletedAt: new Date(), status: 'closed' }).where(eq(calls.id, id));
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'call.delete', entity: 'calls', entityId: id, ip: ctx.ip });
  }

  // ---------- Organization ----------
  async org(ctx: TenantContext) {
    const fs = await this.db.select().from(faculties).where(scoped(ctx, faculties)).orderBy(asc(faculties.name));
    const ds = await this.db.select().from(departments).where(scoped(ctx, departments)).orderBy(asc(departments.name));
    return fs.map((f) => ({ id: f.id, name: f.name, departments: ds.filter((d) => d.facultyId === f.id).map((d) => ({ id: d.id, name: d.name })) }));
  }

  async addOrg(ctx: TenantContext, name: string, facultyId?: string) {
    requirePermission(ctx, 'org.manage');
    if (facultyId) {
      const [f] = await this.db.select({ id: faculties.id }).from(faculties).where(scoped(ctx, faculties, eq(faculties.id, facultyId)));
      if (!f) throw Errors.validation('دانشکده نامعتبر است');
      const [d] = await this.db.insert(departments).values({ tenantId: ctx.tenantId, facultyId, name }).returning();
      await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'org.create', entity: 'departments', entityId: d.id, after: { name }, ip: ctx.ip });
      return d;
    }
    const [f] = await this.db.insert(faculties).values({ tenantId: ctx.tenantId, name }).returning();
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'org.create', entity: 'faculties', entityId: f.id, after: { name }, ip: ctx.ip });
    return f;
  }

  async renameOrg(ctx: TenantContext, kind: 'faculty' | 'department', id: string, name: string) {
    requirePermission(ctx, 'org.manage');
    const t = kind === 'faculty' ? faculties : departments;
    const [r] = await this.db.update(t).set({ name }).where(scoped(ctx, t, eq(t.id, id))).returning();
    if (!r) throw Errors.notFound();
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'org.rename', entity: kind, entityId: id, after: { name }, ip: ctx.ip });
    return r;
  }

  async removeOrg(ctx: TenantContext, kind: 'faculty' | 'department', id: string) {
    requirePermission(ctx, 'org.manage');
    if (kind === 'faculty') {
      const [d] = await this.db.select({ id: departments.id }).from(departments).where(scoped(ctx, departments, eq(departments.facultyId, id))).limit(1);
      if (d) throw Errors.validation('ابتدا گروه‌های این دانشکده را حذف کنید');
    } else {
      const [c] = await this.db.select({ id: calls.id }).from(calls).where(scoped(ctx, calls, eq(calls.departmentId, id))).limit(1);
      if (c) throw Errors.validation('این گروه در فراخوان‌ها استفاده شده است');
    }
    const t = kind === 'faculty' ? faculties : departments;
    const [r] = await this.db.update(t).set({ deletedAt: new Date() }).where(scoped(ctx, t, eq(t.id, id))).returning();
    if (!r) throw Errors.notFound();
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'org.delete', entity: kind, entityId: id, ip: ctx.ip });
  }

  // ---------- Committee members ----------
  async members(ctx: TenantContext) {
    requirePermission(ctx, 'members.manage');
    const rows = await this.db.select({
      id: committeeMembers.id, userId: users.id, fullName: users.fullName, mobile: users.mobile, specialization: committeeMembers.specialization,
      facultyId: committeeMembers.facultyId, active: committeeMembers.active,
      isChair: sql<boolean>`exists(select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = ${users.id} and r.key = 'committee_chair')`,
      openCount: sql<number>`(select count(*)::int from committee_assignments ca where ca.member_id = ${committeeMembers.id} and ca.status <> 'done')`,
      doneCount: sql<number>`(select count(*)::int from committee_assignments ca where ca.member_id = ${committeeMembers.id} and ca.status = 'done')`,
    }).from(committeeMembers).innerJoin(users, eq(users.id, committeeMembers.userId))
      .where(eq(committeeMembers.tenantId, ctx.tenantId)).orderBy(desc(committeeMembers.active), asc(users.fullName));
    return rows;
  }

  private async setCommitteeRole(tx: Db, ctx: TenantContext, userId: string, role: 'committee_member' | 'committee_chair' | null) {
    const rs = await tx.select().from(roles).where(inArray(roles.key, ['committee_member', 'committee_chair']));
    await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.roleId, rs.map((r) => r.id))));
    if (role) await tx.insert(userRoles).values({ tenantId: ctx.tenantId, userId, roleId: rs.find((r) => r.key === role)!.id });
  }

  async addMember(ctx: TenantContext, input: z.infer<typeof memberInputSchema>) {
    requirePermission(ctx, 'members.manage');
    return this.db.transaction(async (tx) => {
      let [u] = await tx.select().from(users).where(and(eq(users.tenantId, ctx.tenantId), eq(users.mobile, input.mobile), isNull(users.deletedAt)));
      if (!u) [u] = await tx.insert(users).values({ tenantId: ctx.tenantId, mobile: input.mobile, fullName: input.fullName }).returning();
      else if (!u.fullName) await tx.update(users).set({ fullName: input.fullName }).where(eq(users.id, u.id));
      const [m] = await tx.insert(committeeMembers).values({ tenantId: ctx.tenantId, userId: u.id, specialization: input.specialization ?? null, facultyId: input.facultyId ?? null })
        .onConflictDoUpdate({ target: [committeeMembers.tenantId, committeeMembers.userId], set: { active: true, specialization: input.specialization ?? null, facultyId: input.facultyId ?? null } }).returning();
      await this.setCommitteeRole(tx as unknown as Db, ctx, u.id, input.role);
      await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'member.add', entity: 'committee_members', entityId: m.id, after: { userId: u.id, role: input.role }, ip: ctx.ip });
      return m;
    });
  }

  async updateMember(ctx: TenantContext, id: string, patch: { active?: boolean; role?: 'committee_member' | 'committee_chair'; specialization?: string | null }) {
    requirePermission(ctx, 'members.manage');
    const [m] = await this.db.select().from(committeeMembers).where(and(eq(committeeMembers.id, id), eq(committeeMembers.tenantId, ctx.tenantId)));
    if (!m) throw Errors.notFound('عضو');
    await this.db.transaction(async (tx) => {
      const set: Partial<typeof committeeMembers.$inferInsert> = {};
      if (patch.active !== undefined) set.active = patch.active;
      if (patch.specialization !== undefined) set.specialization = patch.specialization;
      if (Object.keys(set).length) await tx.update(committeeMembers).set(set).where(eq(committeeMembers.id, id));
      if (patch.active === false) await this.setCommitteeRole(tx as unknown as Db, ctx, m.userId, null);
      else if (patch.role || patch.active === true) {
        const isChair = (await tx.select({ k: roles.key }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, m.userId))).some((r) => r.k === 'committee_chair');
        await this.setCommitteeRole(tx as unknown as Db, ctx, m.userId, patch.role ?? (isChair ? 'committee_chair' : 'committee_member'));
      }
      await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'member.update', entity: 'committee_members', entityId: id, before: { active: m.active }, after: patch, ip: ctx.ip });
    });
    return { ok: true };
  }

  // ---------- Reports & audit ----------
  async exportReport(ctx: TenantContext, format: 'csv' | 'xlsx' | 'pdf', callId?: string): Promise<string | Buffer> {
    requirePermission(ctx, 'reports.export');
    const rows = await this.db.select({
      name: users.fullName, mobile: users.mobile, call: calls.title, status: applications.status, submittedAt: applications.submittedAt, finalScore: applications.finalScore,
      reviewers: sql<number>`(select count(*)::int from committee_assignments ca join evaluations e on e.assignment_id = ca.id where ca.application_id = ${applications.id} and e.submitted_at is not null)`,
      decisionNote: applications.decisionNote,
    }).from(applications).innerJoin(users, eq(users.id, applications.applicantId)).innerJoin(calls, eq(calls.id, applications.callId))
      .where(scoped(ctx, applications, ne(applications.status, 'draft'), callId ? eq(applications.callId, callId) : undefined))
      .orderBy(asc(calls.title), sql`${applications.finalScore} desc nulls last`);
    const head = ['ردیف', 'نام متقاضی', 'موبایل', 'فراخوان', 'وضعیت', 'تاریخ ارسال', 'امتیاز نهایی', 'تعداد ارزیابی', 'توضیح'];
    const data = rows.map((r, i) => [i + 1, r.name, r.mobile, r.call, STATUS_LABELS_FA[r.status as ApplicationStatus], jalaliDate(r.submittedAt), r.finalScore == null ? '' : Number(r.finalScore), r.reviewers, r.decisionNote]);
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'report.export', entity: 'applications', after: { callId: callId ?? null, rows: rows.length, format }, ip: ctx.ip });
    const [t] = await this.db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, ctx.tenantId));
    const title = `فهرست متقاضیان — ${t?.name ?? ''}`;
    if (format === 'csv') return buildCsv(head, data);
    if (format === 'xlsx') return buildXlsx(title, head, data);
    return buildPdf(title, `تاریخ گزارش: ${jalaliDate(new Date())} — تعداد: ${rows.length}`, head, data, [4, 14, 10, 16, 10, 9, 7, 7, 23]);
  }

  auditLog(ctx: TenantContext, opts: { entity?: string; limit: number; offset: number }) {
    requirePermission(ctx, 'reports.export');
    return this.db.select({ id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, entityId: auditLogs.entityId, before: auditLogs.before, after: auditLogs.after, ip: auditLogs.ip, createdAt: auditLogs.createdAt, actor: users.fullName, actorMobile: users.mobile })
      .from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(and(eq(auditLogs.tenantId, ctx.tenantId), opts.entity ? eq(auditLogs.entity, opts.entity) : undefined))
      .orderBy(desc(auditLogs.createdAt)).limit(opts.limit).offset(opts.offset);
  }
}
