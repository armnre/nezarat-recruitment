import { and, count, countDistinct, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { applications, calls, tenants } from '../db/schema.js';
import { AppError, Errors } from './errors.js';

const limitError = (msg: string) => new AppError(403, 'SUBSCRIPTION_LIMIT', msg);

/** اشتراک فعال: وضعیت active و تاریخ پایان نگذشته باشد. */
export async function assertSubscriptionActive(db: Db, tenantId: string, now = new Date()) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!t) throw Errors.notFound('دانشگاه');
  if (t.status !== 'active') throw limitError('حساب این دانشگاه غیرفعال است');
  if (t.subscriptionEndsAt && t.subscriptionEndsAt < now) throw limitError('اشتراک این دانشگاه به پایان رسیده است؛ با مدیر سامانه تماس بگیرید');
  return t;
}

/** سقف تعداد متقاضی (متقاضیان یکتا با حداقل یک درخواست). */
export async function assertApplicantCapacity(db: Db, tenantId: string, applicantId: string) {
  const t = await assertSubscriptionActive(db, tenantId);
  const [{ mine }] = await db.select({ mine: count() }).from(applications)
    .where(and(eq(applications.tenantId, tenantId), eq(applications.applicantId, applicantId), isNull(applications.deletedAt)));
  if (mine > 0) return;
  const [{ n }] = await db.select({ n: countDistinct(applications.applicantId) }).from(applications)
    .where(and(eq(applications.tenantId, tenantId), isNull(applications.deletedAt)));
  if (n >= t.maxApplicants) throw limitError('ظرفیت پذیرش متقاضی در اشتراک این دانشگاه تکمیل شده است');
}

/** سقف تعداد فراخوان (حذف‌نشده). */
export async function assertCallCapacity(db: Db, tenantId: string) {
  const t = await assertSubscriptionActive(db, tenantId);
  const [{ n }] = await db.select({ n: count() }).from(calls).where(and(eq(calls.tenantId, tenantId), isNull(calls.deletedAt)));
  if (n >= t.maxCalls) throw limitError('سقف تعداد فراخوان در اشتراک این دانشگاه تکمیل شده است');
}
