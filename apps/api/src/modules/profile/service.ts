import { and, asc, eq, isNull } from 'drizzle-orm';
import { familyStepSchema, identityStepSchema, resumeSchemas, type ResumeSection } from '@nezarat/shared';
import type { z } from 'zod';
import type { Db } from '../../db/client.js';
import {
  applicantProfiles, education, executiveExperience, patents, publications, researchProjects, teachingExperience, users,
} from '../../db/schema.js';
import { requirePermission, scoped, type TenantContext } from '../../lib/tenant.js';
import { Errors } from '../../lib/errors.js';

export const RESUME_TABLES = {
  education, publications, researchProjects, teachingExperience, executiveExperience, patents,
} as const;

export class ProfileService {
  constructor(private db: Db) {}

  /** Own profile (created lazily). */
  async mine(ctx: TenantContext): Promise<typeof applicantProfiles.$inferSelect> {
    requirePermission(ctx, 'profile.own');
    const [p] = await this.db.select().from(applicantProfiles).where(scoped(ctx, applicantProfiles, eq(applicantProfiles.userId, ctx.userId)));
    if (p) return p;
    const [created] = await this.db.insert(applicantProfiles).values({ tenantId: ctx.tenantId, userId: ctx.userId })
      .onConflictDoNothing().returning();
    return created ?? (await this.mine(ctx));
  }

  async saveIdentity(ctx: TenantContext, data: z.infer<typeof identityStepSchema>) {
    const p = await this.mine(ctx);
    const [u] = await this.db.update(applicantProfiles)
      .set({ ...data, stepCompleted: Math.max(p.stepCompleted, 1) })
      .where(and(eq(applicantProfiles.id, p.id), eq(applicantProfiles.tenantId, ctx.tenantId))).returning();
    await this.db.update(users).set({ fullName: `${data.firstName} ${data.lastName}`, email: data.email ?? undefined })
      .where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)));
    return u;
  }

  async saveFamily(ctx: TenantContext, data: z.infer<typeof familyStepSchema>) {
    const p = await this.mine(ctx);
    const [u] = await this.db.update(applicantProfiles)
      .set({ maritalStatus: data.maritalStatus, family: { spouseName: data.spouseName ?? undefined, childrenCount: data.childrenCount }, stepCompleted: Math.max(p.stepCompleted, 3) })
      .where(and(eq(applicantProfiles.id, p.id), eq(applicantProfiles.tenantId, ctx.tenantId))).returning();
    return u;
  }

  async markEducationStep(ctx: TenantContext) {
    const p = await this.mine(ctx);
    const rows = await this.listSection(ctx, 'education', p.id);
    if (!rows.length) throw Errors.validation('حداقل یک سابقهٔ تحصیلی ثبت کنید');
    await this.db.update(applicantProfiles).set({ stepCompleted: Math.max(p.stepCompleted, 2) }).where(eq(applicantProfiles.id, p.id));
  }

  listSection(ctx: TenantContext, section: ResumeSection, profileId: string) {
    const t = RESUME_TABLES[section];
    return this.db.select().from(t).where(scoped(ctx, t, eq(t.profileId, profileId))).orderBy(asc(t.createdAt));
  }

  /** Full resume of any profile in the tenant (for staff). */
  async fullResume(ctx: TenantContext, profileId: string) {
    const entries = await Promise.all(
      (Object.keys(RESUME_TABLES) as ResumeSection[]).map(async (s) => [s, await this.listSection(ctx, s, profileId)] as const));
    return Object.fromEntries(entries) as Record<ResumeSection, unknown[]>;
  }

  async addItem(ctx: TenantContext, section: ResumeSection, body: unknown) {
    const data = resumeSchemas[section].parse(body);
    const p = await this.mine(ctx);
    const t = RESUME_TABLES[section];
    const [row] = await this.db.insert(t).values({ ...(data as object), tenantId: ctx.tenantId, profileId: p.id } as never).returning();
    return row;
  }

  async updateItem(ctx: TenantContext, section: ResumeSection, id: string, body: unknown) {
    const data = resumeSchemas[section].parse(body);
    const p = await this.mine(ctx);
    const t = RESUME_TABLES[section];
    const [row] = await this.db.update(t).set(data as never).where(scoped(ctx, t, eq(t.id, id), eq(t.profileId, p.id))).returning();
    if (!row) throw Errors.notFound('مورد');
    return row;
  }

  async deleteItem(ctx: TenantContext, section: ResumeSection, id: string) {
    const p = await this.mine(ctx);
    const t = RESUME_TABLES[section];
    const [row] = await this.db.update(t).set({ deletedAt: new Date() } as never)
      .where(and(eq(t.tenantId, ctx.tenantId), eq(t.id, id), eq(t.profileId, p.id), isNull(t.deletedAt))).returning();
    if (!row) throw Errors.notFound('مورد');
  }
}
