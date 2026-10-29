import { z } from 'zod';

/** ارقام فارسی/عربی → لاتین */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** شماره موبایل ایران؛ ارقام فارسی/عربی به لاتین تبدیل و به قالب 09xxxxxxxxx نرمال می‌شود. */
export function normalizeMobile(input: string): string {
  const latin = toLatinDigits(input).replace(/[\s-]/g, '');
  return latin.replace(/^(\+98|0098|98)/, '0').replace(/^9/, '09');
}

export const mobileSchema = z
  .string()
  .transform(normalizeMobile)
  .refine((v) => /^09\d{9}$/.test(v), { message: 'شماره موبایل معتبر نیست' });

export const otpRequestSchema = z.object({ tenantSlug: z.string().min(1), mobile: mobileSchema });
export const otpVerifySchema = otpRequestSchema.extend({
  code: z.string().transform(toLatinDigits).pipe(z.string().regex(/^\d{6}$/, 'کد تأیید باید ۶ رقم باشد')),
});
export const passwordLoginSchema = z.object({
  email: z.string().email('ایمیل معتبر نیست'),
  password: z.string().min(8, 'رمز عبور حداقل ۸ کاراکتر است'),
  tenantSlug: z.string().optional(),
});

export type RoleKey = 'applicant' | 'committee_member' | 'committee_chair' | 'university_admin' | 'super_admin';

export interface MeResponse {
  id: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  tenant: { id: string; slug: string; name: string } | null;
  roles: RoleKey[];
  permissions: string[];
}
