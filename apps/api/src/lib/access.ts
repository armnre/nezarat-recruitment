import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { committeeAssignments, committeeMembers } from '../db/schema.js';
import type { TenantContext } from './tenant.js';

/** Is the caller an active committee member assigned to this application (same tenant)? */
export async function isAssignedTo(db: Db, ctx: TenantContext, applicationId: string) {
  if (!ctx.permissions.includes('applications.view_assigned')) return false;
  const [a] = await db.select({ id: committeeAssignments.id }).from(committeeAssignments)
    .innerJoin(committeeMembers, eq(committeeMembers.id, committeeAssignments.memberId))
    .where(and(eq(committeeAssignments.tenantId, ctx.tenantId), eq(committeeAssignments.applicationId, applicationId),
      eq(committeeMembers.userId, ctx.userId), eq(committeeMembers.active, true))).limit(1);
  return !!a;
}

/** Owner, tenant-wide staff, or an assigned reviewer. */
export async function canViewApplication(db: Db, ctx: TenantContext, app: { id: string; applicantId: string }) {
  if (app.applicantId === ctx.userId || ctx.permissions.includes('applications.view_all')) return true;
  if (ctx.permissions.includes('evaluations.finalize')) return true;
  return isAssignedTo(db, ctx, app.id);
}
