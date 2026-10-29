import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { weightedTotal, type EvaluationInput } from '@nezarat/shared';
import type { Db } from '../../db/client.js';
import {
  applicantProfiles, applications, calls, committeeAssignments, committeeMembers, documents,
  evaluations, evaluationScores, notifications, scoringCriteria, users,
} from '../../db/schema.js';
import { requirePermission, scoped, type TenantContext } from '../../lib/tenant.js';
import { AppError, Errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { enqueue } from '../../lib/queue.js';
import type { ApplicationService } from '../applications/service.js';
import type { ProfileService } from '../profile/service.js';

const REVIEWABLE = ['committee_review', 'interview'] as const;
const canManage = (ctx: TenantContext) => ctx.permissions.includes('evaluations.finalize') || ctx.permissions.includes('members.manage');

export class CommitteeService {
  constructor(private db: Db, private apps: ApplicationService, private profiles: ProfileService) {}

  private async myMember(ctx: TenantContext) {
    const [m] = await this.db.select().from(committeeMembers)
      .where(and(eq(committeeMembers.tenantId, ctx.tenantId), eq(committeeMembers.userId, ctx.userId), eq(committeeMembers.active, true))).limit(1);
    return m ?? null;
  }

  /** Assignments of the signed-in reviewer with their evaluation progress. */
  async myAssignments(ctx: TenantContext) {
    if (!ctx.permissions.includes('evaluations.score')) return [];
    const m = await this.myMember(ctx);
    if (!m) return [];
    return this.db.select({
      id: committeeAssignments.id, applicationId: applications.id, status: committeeAssignments.status, dueAt: committeeAssignments.dueAt,
      assignedAt: committeeAssignments.createdAt, applicationStatus: applications.status, submittedAt: applications.submittedAt,
      callTitle: calls.title, applicantName: users.fullName, totalScore: evaluations.totalScore, evaluatedAt: evaluations.submittedAt,
    }).from(committeeAssignments)
      .innerJoin(applications, eq(applications.id, committeeAssignments.applicationId))
      .innerJoin(calls, eq(calls.id, applications.callId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .leftJoin(evaluations, eq(evaluations.assignmentId, committeeAssignments.id))
      .where(and(eq(committeeAssignments.tenantId, ctx.tenantId), eq(committeeAssignments.memberId, m.id)))
      .orderBy(asc(committeeAssignments.status), desc(committeeAssignments.createdAt));
  }

  /** Full dossier: application, profile, resume, documents, criteria, and the caller's own evaluation. */
  async dossier(ctx: TenantContext, applicationId: string) {
    const app = await this.apps.get(ctx, applicationId);
    if (app.applicantId === ctx.userId && !canManage(ctx)) throw Errors.forbidden();
    const [call] = await this.db.select().from(calls).where(eq(calls.id, app.callId));
    const [profile] = await this.db.select().from(applicantProfiles).where(scoped(ctx, applicantProfiles, eq(applicantProfiles.userId, app.applicantId)));
    const [applicant] = await this.db.select({ fullName: users.fullName, mobile: users.mobile, email: users.email }).from(users).where(eq(users.id, app.applicantId));
    const criteria = await this.criteria(ctx, app.callId);
    const docs = await this.db.select({ id: documents.id, requiredDocumentId: documents.requiredDocumentId, originalName: documents.originalName, mime: documents.mime, size: documents.size, createdAt: documents.createdAt })
      .from(documents).where(scoped(ctx, documents, eq(documents.applicationId, app.id)));
    const resume = profile ? await this.profiles.fullResume(ctx, profile.id) : null;

    const m = await this.myMember(ctx);
    let mine = null;
    if (m) {
      const [as] = await this.db.select().from(committeeAssignments).where(and(eq(committeeAssignments.applicationId, app.id), eq(committeeAssignments.memberId, m.id)));
      if (as) {
        const [ev] = await this.db.select().from(evaluations).where(eq(evaluations.assignmentId, as.id));
        const scores = ev ? await this.db.select({ criterionId: evaluationScores.criterionId, score: evaluationScores.score }).from(evaluationScores).where(eq(evaluationScores.evaluationId, ev.id)) : [];
        mine = { assignment: as, evaluation: ev ?? null, scores };
      }
    }
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'dossier.view', entity: 'applications', entityId: app.id, ip: ctx.ip });
    return { application: app, call: { id: call.id, title: call.title, workflow: call.workflow }, applicant, profile: profile ?? null, resume, documents: docs, criteria, mine, canManage: canManage(ctx) };
  }

  private criteria(ctx: TenantContext, callId: string) {
    return this.db.select().from(scoringCriteria).where(scoped(ctx, scoringCriteria, eq(scoringCriteria.callId, callId))).orderBy(asc(scoringCriteria.sortOrder), asc(scoringCriteria.createdAt));
  }

  /** Save draft or submit. Every changed score is audited individually; submitted evaluations are locked. */
  async saveEvaluation(ctx: TenantContext, assignmentId: string, input: EvaluationInput) {
    requirePermission(ctx, 'evaluations.score');
    const m = await this.myMember(ctx);
    const [as] = m ? await this.db.select().from(committeeAssignments)
      .where(and(eq(committeeAssignments.id, assignmentId), eq(committeeAssignments.tenantId, ctx.tenantId), eq(committeeAssignments.memberId, m.id))) : [];
    if (!as) throw Errors.notFound('تخصیص');
    const app = await this.apps.get(ctx, as.applicationId);
    if (!(REVIEWABLE as readonly string[]).includes(app.status)) throw Errors.validation('این پرونده در مرحلهٔ امتیازدهی نیست');

    const criteria = await this.criteria(ctx, app.callId);
    const byId = new Map(criteria.map((c) => [c.id, c]));
    for (const s of input.scores) {
      const c = byId.get(s.criterionId);
      if (!c) throw Errors.validation('معیار امتیازدهی نامعتبر است');
      if (s.score > c.maxScore) throw Errors.validation(`امتیاز «${c.title}» نباید بیشتر از ${c.maxScore} باشد`);
    }
    if (input.submit) {
      if (input.scores.length !== criteria.length || new Set(input.scores.map((s) => s.criterionId)).size !== criteria.length) throw Errors.validation('برای ارسال نهایی باید به همهٔ معیارها امتیاز دهید');
      if (!input.recommendation) throw Errors.validation('پیشنهاد نهایی خود را انتخاب کنید');
    }
    const total = weightedTotal(input.scores.map((s) => ({ score: s.score, maxScore: byId.get(s.criterionId)!.maxScore, weight: Number(byId.get(s.criterionId)!.weight) })));

    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(evaluations).where(eq(evaluations.assignmentId, as.id)).for('update');
      if (existing?.submittedAt) throw new AppError(409, 'LOCKED', 'ارزیابی ارسال‌شده قابل ویرایش نیست');
      const values = { comment: input.comment ?? null, recommendation: input.recommendation ?? null, totalScore: String(total), submittedAt: input.submit ? new Date() : null };
      const [ev] = existing
        ? await tx.update(evaluations).set(values).where(eq(evaluations.id, existing.id)).returning()
        : await tx.insert(evaluations).values({ tenantId: ctx.tenantId, assignmentId: as.id, ...values }).returning();
      const prev = existing ? await tx.select().from(evaluationScores).where(eq(evaluationScores.evaluationId, ev.id)) : [];
      const prevMap = new Map(prev.map((p) => [p.criterionId, Number(p.score)]));
      for (const s of input.scores) {
        const before = prevMap.get(s.criterionId);
        if (before === s.score) continue;
        await tx.insert(evaluationScores).values({ tenantId: ctx.tenantId, evaluationId: ev.id, criterionId: s.criterionId, score: String(s.score) })
          .onConflictDoUpdate({ target: [evaluationScores.evaluationId, evaluationScores.criterionId], set: { score: String(s.score), updatedAt: new Date() } });
        await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'evaluation.score', entity: 'evaluation_scores', entityId: ev.id,
          before: before === undefined ? null : { criterionId: s.criterionId, score: before }, after: { criterionId: s.criterionId, score: s.score, applicationId: app.id }, ip: ctx.ip });
      }
      if ((existing?.comment ?? null) !== values.comment || (existing?.recommendation ?? null) !== values.recommendation) {
        await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'evaluation.comment', entity: 'evaluations', entityId: ev.id,
          before: existing ? { comment: existing.comment, recommendation: existing.recommendation } : null, after: { comment: values.comment, recommendation: values.recommendation }, ip: ctx.ip });
      }
      if (input.submit) {
        await tx.update(committeeAssignments).set({ status: 'done' }).where(eq(committeeAssignments.id, as.id));
        await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'evaluation.submit', entity: 'evaluations', entityId: ev.id, after: { totalScore: total, applicationId: app.id }, ip: ctx.ip });
      } else if (as.status === 'pending') {
        await tx.update(committeeAssignments).set({ status: 'in_progress' }).where(eq(committeeAssignments.id, as.id));
      }
      return ev;
    });
  }

  // ---------- Chair / admin ----------

  listMembers(ctx: TenantContext) {
    if (!canManage(ctx)) throw Errors.forbidden();
    return this.db.select({ id: committeeMembers.id, userId: committeeMembers.userId, fullName: users.fullName, specialization: committeeMembers.specialization,
      openCount: sql<number>`(select count(*)::int from committee_assignments ca where ca.member_id = ${committeeMembers.id} and ca.status <> 'done')` })
      .from(committeeMembers).innerJoin(users, eq(users.id, committeeMembers.userId))
      .where(and(eq(committeeMembers.tenantId, ctx.tenantId), eq(committeeMembers.active, true))).orderBy(asc(users.fullName));
  }

  /** Applications ready for or under committee review, with assignment/evaluation counts. */
  queue(ctx: TenantContext) {
    if (!canManage(ctx)) throw Errors.forbidden();
    return this.db.select({
      id: applications.id, status: applications.status, submittedAt: applications.submittedAt, finalScore: applications.finalScore,
      callTitle: calls.title, applicantName: users.fullName, minReviewers: sql<number>`(${calls.workflow}->>'minReviewers')::int`,
      assigned: sql<number>`(select count(*)::int from committee_assignments ca where ca.application_id = ${applications.id})`,
      evaluated: sql<number>`(select count(*)::int from committee_assignments ca join evaluations e on e.assignment_id = ca.id where ca.application_id = ${applications.id} and e.submitted_at is not null)`,
    }).from(applications).innerJoin(calls, eq(calls.id, applications.callId)).innerJoin(users, eq(users.id, applications.applicantId))
      .where(scoped(ctx, applications, inArray(applications.status, ['screening', 'committee_review', 'interview', 'scored'])))
      .orderBy(asc(applications.submittedAt));
  }

  /** Assign reviewers; a screened application moves into committee review on first assignment. */
  async assign(ctx: TenantContext, applicationId: string, memberIds: string[], dueAt?: Date | null) {
    if (!canManage(ctx)) throw Errors.forbidden();
    const app = await this.apps.get(ctx, applicationId);
    if (!['screening', ...REVIEWABLE].includes(app.status)) throw Errors.validation('در این وضعیت امکان تخصیص داور وجود ندارد');
    const members = await this.db.select({ id: committeeMembers.id, userId: committeeMembers.userId, mobile: users.mobile }).from(committeeMembers).innerJoin(users, eq(users.id, committeeMembers.userId))
      .where(and(eq(committeeMembers.tenantId, ctx.tenantId), eq(committeeMembers.active, true), inArray(committeeMembers.id, memberIds)));
    if (members.length !== new Set(memberIds).size) throw Errors.validation('داور انتخاب‌شده نامعتبر است');
    if (members.some((m) => m.userId === app.applicantId)) throw Errors.validation('متقاضی نمی‌تواند داور پرونده خود باشد');

    const created = await this.db.transaction(async (tx) => {
      const rows = await tx.insert(committeeAssignments).values(members.map((m) => ({ tenantId: ctx.tenantId, applicationId, memberId: m.id, dueAt: dueAt ?? null })))
        .onConflictDoNothing().returning();
      for (const r of rows) {
        const m = members.find((x) => x.id === r.memberId)!;
        await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'committee.assign', entity: 'committee_assignments', entityId: r.id, after: { applicationId, memberId: r.memberId, dueAt }, ip: ctx.ip });
        await tx.insert(notifications).values({ tenantId: ctx.tenantId, userId: m.userId, channel: 'inapp', title: 'پرونده جدید برای ارزیابی', body: 'یک پرونده برای ارزیابی به شما تخصیص داده شد.' });
        const payload = { userId: m.userId, templateKey: 'committee.assigned', params: { applicationId } };
        if (m.mobile) await enqueue(tx, 'sms.notify', { ...payload, mobile: m.mobile }, { tenantId: ctx.tenantId });
        if (dueAt && dueAt.getTime() - 86400000 > Date.now()) {
          await enqueue(tx, 'reminder.deadline', { ...payload, templateKey: 'committee.due', mobile: m.mobile }, { tenantId: ctx.tenantId, runAt: new Date(dueAt.getTime() - 86400000) });
        }
      }
      return rows;
    });
    if (app.status === 'screening') await this.apps.transition(ctx, applicationId, 'committee_review', 'ارجاع به کمیته');
    return { assigned: created.length };
  }

  async unassign(ctx: TenantContext, assignmentId: string) {
    if (!canManage(ctx)) throw Errors.forbidden();
    const [as] = await this.db.select().from(committeeAssignments).where(and(eq(committeeAssignments.id, assignmentId), eq(committeeAssignments.tenantId, ctx.tenantId)));
    if (!as) throw Errors.notFound('تخصیص');
    const [ev] = await this.db.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.assignmentId, as.id));
    if (ev) throw Errors.validation('داوری که ارزیابی ثبت کرده قابل حذف نیست');
    await this.db.delete(committeeAssignments).where(eq(committeeAssignments.id, as.id));
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'committee.unassign', entity: 'committee_assignments', entityId: as.id, before: as, ip: ctx.ip });
  }

  /** All reviewers' evaluations for an application, with per-criterion averages. */
  async summary(ctx: TenantContext, applicationId: string) {
    if (!canManage(ctx)) throw Errors.forbidden();
    const app = await this.apps.get(ctx, applicationId);
    const criteria = await this.criteria(ctx, app.callId);
    const rows = await this.db.select({
      assignmentId: committeeAssignments.id, memberId: committeeMembers.id, reviewer: users.fullName, status: committeeAssignments.status, dueAt: committeeAssignments.dueAt,
      evaluationId: evaluations.id, totalScore: evaluations.totalScore, comment: evaluations.comment, recommendation: evaluations.recommendation, submittedAt: evaluations.submittedAt,
    }).from(committeeAssignments).innerJoin(committeeMembers, eq(committeeMembers.id, committeeAssignments.memberId)).innerJoin(users, eq(users.id, committeeMembers.userId))
      .leftJoin(evaluations, eq(evaluations.assignmentId, committeeAssignments.id))
      .where(and(eq(committeeAssignments.tenantId, ctx.tenantId), eq(committeeAssignments.applicationId, app.id)));
    const evalIds = rows.filter((r) => r.submittedAt && r.evaluationId).map((r) => r.evaluationId!);
    const scores = evalIds.length ? await this.db.select().from(evaluationScores).where(inArray(evaluationScores.evaluationId, evalIds)) : [];
    const reviewers = rows.map((r) => ({ ...r, scores: r.submittedAt ? scores.filter((s) => s.evaluationId === r.evaluationId).map((s) => ({ criterionId: s.criterionId, score: Number(s.score) })) : [] }));
    const submitted = reviewers.filter((r) => r.submittedAt);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
    return {
      criteria: criteria.map((c) => ({ ...c, average: avg(scores.filter((s) => s.criterionId === c.id).map((s) => Number(s.score))) })),
      reviewers, average: avg(submitted.map((r) => Number(r.totalScore))), submittedCount: submitted.length,
    };
  }

  /** Chair finalises: needs minReviewers submitted evaluations; stores the mean and moves to «scored». */
  async finalize(ctx: TenantContext, applicationId: string, note?: string) {
    requirePermission(ctx, 'evaluations.finalize');
    const app = await this.apps.get(ctx, applicationId);
    const [call] = await this.db.select({ workflow: calls.workflow }).from(calls).where(eq(calls.id, app.callId));
    const s = await this.summary(ctx, applicationId);
    const min = call?.workflow.minReviewers ?? 2;
    if (s.submittedCount < min) throw Errors.validation(`حداقل ${min} ارزیابی ارسال‌شده لازم است (اکنون ${s.submittedCount})`);
    const updated = await this.apps.transition(ctx, applicationId, 'scored', note);
    await this.db.update(applications).set({ finalScore: String(s.average) }).where(and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)));
    await audit(this.db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'evaluation.finalize', entity: 'applications', entityId: applicationId, after: { finalScore: s.average, reviewers: s.submittedCount }, ip: ctx.ip });
    return { ...updated, finalScore: String(s.average) };
  }
}

