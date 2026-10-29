import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { canTransition, type ApplicationStatus } from '@nezarat/shared';
import type { Db } from '../../db/client.js';
import { applicantProfiles, applications, applicationStatusHistory, callRequiredDocuments, calls, documents, users } from '../../db/schema.js';
import { isNull, inArray } from 'drizzle-orm';
import { requirePermission, scoped, type TenantContext } from '../../lib/tenant.js';
import { AppError, Errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { enqueue } from '../../lib/queue.js';
import { canViewApplication } from '../../lib/access.js';

const invalidTransition = () => new AppError(409, 'INVALID_TRANSITION', 'تغییر وضعیت درخواست‌شده مجاز نیست');
const APPLICANT_MOVES: ApplicationStatus[] = ['submitted', 'withdrawn'];

export class ApplicationService {
  constructor(private db: Db) {}

  /** Applicants see their own; staff with applications.view_all see the whole tenant. */
  list(ctx: TenantContext) {
    const all = ctx.permissions.includes('applications.view_all');
    return this.db.select({
      id: applications.id, callId: applications.callId, applicantId: applications.applicantId, status: applications.status,
      submittedAt: applications.submittedAt, finalScore: applications.finalScore, createdAt: applications.createdAt, updatedAt: applications.updatedAt,
      callTitle: calls.title, callClosesAt: calls.closesAt, applicantName: users.fullName,
    }).from(applications)
      .innerJoin(calls, eq(calls.id, applications.callId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .where(scoped(ctx, applications, all ? undefined : eq(applications.applicantId, ctx.userId)))
      .orderBy(desc(applications.createdAt));
  }

  async get(ctx: TenantContext, id: string) {
    const [a] = await this.db.select().from(applications).where(scoped(ctx, applications, eq(applications.id, id))).limit(1);
    if (!a || !(await canViewApplication(this.db, ctx, a))) throw Errors.notFound('درخواست');
    return a;
  }

  async create(ctx: TenantContext, callId: string) {
    requirePermission(ctx, 'applications.own');
    const now = new Date();
    const [call] = await this.db.select().from(calls)
      .where(scoped(ctx, calls, eq(calls.id, callId), eq(calls.status, 'published'), lte(calls.opensAt, now), gte(calls.closesAt, now))).limit(1);
    if (!call) throw Errors.validation('این فراخوان فعال نیست');
    const [a] = await this.db.insert(applications).values({ tenantId: ctx.tenantId, callId, applicantId: ctx.userId }).onConflictDoNothing().returning();
    if (!a) throw Errors.conflict('قبلاً برای این فراخوان درخواست ثبت کرده‌اید');
    await this.db.insert(applicationStatusHistory).values({ tenantId: ctx.tenantId, applicationId: a.id, toStatus: 'draft', changedBy: ctx.userId });
    return a;
  }

  /** The single entry point for status changes: validate → update (optimistic) → history + audit → notify. */
  async transition(ctx: TenantContext, id: string, to: ApplicationStatus, note?: string) {
    const app = await this.get(ctx, id);
    const isOwner = app.applicantId === ctx.userId;
    if (isOwner && !APPLICANT_MOVES.includes(to)) throw Errors.forbidden();
    if (!isOwner) requirePermission(ctx, 'applications.change_status');

    const [call] = await this.db.select({ workflow: calls.workflow }).from(calls).where(eq(calls.id, app.callId));
    if (!canTransition(app.status, to, { interview: call?.workflow.interview ?? true })) throw invalidTransition();

    if (to === 'submitted') await this.assertReadyToSubmit(ctx, app);

    return this.db.transaction(async (tx) => {
      const [updated] = await tx.update(applications)
        .set({ status: to, submittedAt: to === 'submitted' ? new Date() : app.submittedAt, decisionNote: note ?? app.decisionNote })
        .where(and(eq(applications.id, id), eq(applications.tenantId, ctx.tenantId), eq(applications.status, app.status)))
        .returning();
      if (!updated) throw invalidTransition();
      await tx.insert(applicationStatusHistory).values({ tenantId: ctx.tenantId, applicationId: id, fromStatus: app.status, toStatus: to, changedBy: ctx.userId, note });
      await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'application.status', entity: 'applications', entityId: id, before: { status: app.status }, after: { status: to, note }, ip: ctx.ip });
      const [u] = await tx.select({ mobile: users.mobile, email: users.email }).from(users).where(eq(users.id, app.applicantId));
      const payload = { userId: app.applicantId, templateKey: `status.${to}`, params: { status: to } };
      if (u?.mobile) await enqueue(tx, 'sms.notify', { ...payload, mobile: u.mobile }, { tenantId: ctx.tenantId });
      if (u?.email) await enqueue(tx, 'email.send', { ...payload, to: u.email }, { tenantId: ctx.tenantId });
      return updated;
    });
  }

  /** Profile steps complete + every required document uploaded + call still open. */
  private async assertReadyToSubmit(ctx: TenantContext, app: { id: string; callId: string; applicantId: string }) {
    const [p] = await this.db.select({ step: applicantProfiles.stepCompleted }).from(applicantProfiles)
      .where(and(eq(applicantProfiles.tenantId, ctx.tenantId), eq(applicantProfiles.userId, app.applicantId)));
    if (!p || p.step < 3) throw Errors.validation('ابتدا همهٔ مراحل پرونده (هویتی، تحصیلی، خانوادگی) را تکمیل کنید');
    const [call] = await this.db.select({ closesAt: calls.closesAt }).from(calls).where(eq(calls.id, app.callId));
    if (!call || call.closesAt < new Date()) throw Errors.validation('مهلت ارسال این فراخوان به پایان رسیده است');
    const required = await this.db.select({ id: callRequiredDocuments.id, title: callRequiredDocuments.title }).from(callRequiredDocuments)
      .where(and(eq(callRequiredDocuments.callId, app.callId), eq(callRequiredDocuments.required, true)));
    if (!required.length) return;
    const uploaded = await this.db.select({ rid: documents.requiredDocumentId }).from(documents)
      .where(and(eq(documents.applicationId, app.id), isNull(documents.deletedAt), inArray(documents.requiredDocumentId, required.map((r) => r.id))));
    const missing = required.filter((r) => !uploaded.some((u) => u.rid === r.id));
    if (missing.length) throw Errors.validation(`مدارک الزامی بارگذاری نشده: ${missing.map((m) => m.title).join('، ')}`);
  }

  async history(ctx: TenantContext, id: string) {
    await this.get(ctx, id);
    return this.db.select().from(applicationStatusHistory)
      .where(and(eq(applicationStatusHistory.tenantId, ctx.tenantId), eq(applicationStatusHistory.applicationId, id)))
      .orderBy(applicationStatusHistory.createdAt);
  }
}
