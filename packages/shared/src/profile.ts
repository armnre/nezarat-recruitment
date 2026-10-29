import { z } from 'zod';
import { toLatinDigits } from './auth.js';

const optStr = (max = 300) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ نامعتبر است');
const optDate = z.preprocess((v) => (v === '' ? null : v), isoDate.nullable().optional()).transform((v) => v ?? null);
/** '' / null / undefined → null; otherwise coerced number within bounds. */
const optNum = (min: number, max: number, int = false) =>
  z.preprocess((v) => (v === '' || v == null ? null : typeof v === 'string' ? Number(toLatinDigits(v)) : v),
    (int ? z.number({ invalid_type_error: 'عدد معتبر وارد کنید' }).int('عدد صحیح وارد کنید') : z.number({ invalid_type_error: 'عدد معتبر وارد کنید' }))
      .min(min, `حداقل ${min}`).max(max, `حداکثر ${max}`).nullable());

/** Iranian national code checksum. */
export function isValidNationalCode(raw: string): boolean {
  const c = toLatinDigits(raw);
  if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false;
  const sum = [...c.slice(0, 9)].reduce((s, d, i) => s + Number(d) * (10 - i), 0) % 11;
  const check = Number(c[9]);
  return sum < 2 ? check === sum : check === 11 - sum;
}

export const identityStepSchema = z.object({
  firstName: z.string().trim().min(2, 'نام را وارد کنید').max(100),
  lastName: z.string().trim().min(2, 'نام خانوادگی را وارد کنید').max(100),
  fatherName: z.string().trim().min(2, 'نام پدر را وارد کنید').max(100),
  nationalCode: z.string().transform(toLatinDigits).refine(isValidNationalCode, 'کد ملی معتبر نیست'),
  birthDate: isoDate,
  gender: z.enum(['male', 'female'], { message: 'جنسیت را انتخاب کنید' }),
  email: z.string().trim().email('ایمیل معتبر نیست').optional().or(z.literal('')).transform((v) => v || null),
  province: z.string().trim().min(2, 'استان را وارد کنید').max(100),
  city: z.string().trim().min(2, 'شهر را وارد کنید').max(100),
  address: z.string().trim().min(5, 'نشانی را کامل وارد کنید').max(500),
});
export const familyStepSchema = z.object({
  maritalStatus: z.enum(['single', 'married', 'other'], { message: 'وضعیت تأهل را انتخاب کنید' }),
  spouseName: optStr(100),
  childrenCount: optNum(0, 20, true).transform((v) => v ?? 0),
});

export const resumeSchemas = {
  education: z.object({
    degree: z.enum(['bachelor', 'master', 'phd', 'postdoc'], { message: 'مقطع را انتخاب کنید' }),
    field: z.string().trim().min(2, 'رشته را وارد کنید').max(200),
    university: z.string().trim().min(2, 'دانشگاه را وارد کنید').max(200),
    country: optStr(100), startDate: optDate, endDate: optDate,
    gpa: optNum(0, 20).transform((v) => (v == null ? null : String(v))),
    thesisTitle: optStr(500),
  }),
  publications: z.object({
    type: z.enum(['journal', 'conference', 'book', 'chapter'], { message: 'نوع اثر را انتخاب کنید' }),
    title: z.string().trim().min(3, 'عنوان را وارد کنید').max(500),
    venue: optStr(300), year: optNum(1300, 2100, true),
    doi: optStr(200), indexing: optStr(100), authors: optStr(500), role: optStr(100),
  }),
  researchProjects: z.object({
    title: z.string().trim().min(3, 'عنوان طرح را وارد کنید').max(500),
    employer: optStr(200), role: optStr(100),
    budget: optNum(0, 1e15).transform((v) => (v == null ? null : String(v))),
    startDate: optDate, endDate: optDate, status: optStr(50),
  }),
  teachingExperience: z.object({
    institution: z.string().trim().min(2, 'مؤسسه را وارد کنید').max(200),
    course: z.string().trim().min(2, 'نام درس را وارد کنید').max(200),
    level: optStr(50), startDate: optDate, endDate: optDate,
    hours: optNum(0, 100000, true),
  }),
  executiveExperience: z.object({
    organization: z.string().trim().min(2, 'سازمان را وارد کنید').max(200),
    position: z.string().trim().min(2, 'سمت را وارد کنید').max(200),
    startDate: optDate, endDate: optDate,
  }),
  patents: z.object({
    title: z.string().trim().min(3, 'عنوان اختراع را وارد کنید').max(500),
    number: optStr(100), registrationDate: optDate, country: optStr(100),
  }),
} as const;
export type ResumeSection = keyof typeof resumeSchemas;
export const RESUME_SECTIONS = Object.keys(resumeSchemas) as ResumeSection[];
export const RESUME_LABELS: Record<ResumeSection, string> = {
  education: 'سوابق تحصیلی', publications: 'مقالات و کتاب‌ها', researchProjects: 'طرح‌های پژوهشی',
  teachingExperience: 'سوابق تدریس', executiveExperience: 'سوابق اجرایی', patents: 'اختراعات',
};

export const ALLOWED_UPLOAD_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;
