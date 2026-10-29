import { sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { permissions, rolePermissions, roles, tenants } from './schema.js';

export const ROLES = {
  applicant: 'متقاضی',
  committee_member: 'عضو کمیته',
  committee_chair: 'رئیس کمیته',
  university_admin: 'مدیر دانشگاه',
  super_admin: 'مدیر پلتفرم',
} as const;

export const PERMISSIONS: Record<string, string> = {
  'profile.own': 'مدیریت پرونده شخصی',
  'applications.own': 'ارسال و پیگیری درخواست',
  'applications.view_assigned': 'مشاهده پرونده‌های تخصیص‌یافته',
  'applications.view_all': 'مشاهده همه پرونده‌ها',
  'applications.change_status': 'تغییر وضعیت پرونده',
  'evaluations.score': 'امتیازدهی',
  'evaluations.finalize': 'تصمیم نهایی کمیته',
  'calls.manage': 'مدیریت فراخوان‌ها',
  'org.manage': 'مدیریت ساختار سازمانی',
  'members.manage': 'مدیریت اعضای کمیته',
  'templates.manage': 'مدیریت قالب پیام‌ها',
  'reports.export': 'خروجی گزارش',
  'platform.manage': 'مدیریت پلتفرم',
};

const MATRIX: Record<keyof typeof ROLES, string[]> = {
  applicant: ['profile.own', 'applications.own'],
  committee_member: ['applications.view_assigned', 'evaluations.score'],
  committee_chair: ['applications.view_assigned', 'evaluations.score', 'evaluations.finalize', 'applications.change_status'],
  university_admin: ['applications.view_all', 'applications.change_status', 'calls.manage', 'org.manage', 'members.manage', 'templates.manage', 'reports.export', 'evaluations.finalize'],
  super_admin: ['platform.manage'],
};

/** idempotent: نقش‌ها، مجوزها و نخستین tenant (دانشگاه شمال). */
export async function seedRbac(db: Db) {
  await db.insert(roles).values(Object.entries(ROLES).map(([key, title]) => ({ key, title }))).onConflictDoNothing();
  await db.insert(permissions).values(Object.entries(PERMISSIONS).map(([key, title]) => ({ key, title }))).onConflictDoNothing();
  const r = await db.select().from(roles);
  const p = await db.select().from(permissions);
  const rows = Object.entries(MATRIX).flatMap(([role, perms]) =>
    perms.map((perm) => ({ roleId: r.find((x) => x.key === role)!.id, permissionId: p.find((x) => x.key === perm)!.id })));
  await db.insert(rolePermissions).values(rows).onConflictDoNothing();
  await db.insert(tenants).values({ slug: 'shomal', name: 'دانشگاه شمال' }).onConflictDoNothing({ target: tenants.slug });
  await db.execute(sql`select 1`);
}
