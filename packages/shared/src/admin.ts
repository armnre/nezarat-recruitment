import { z } from 'zod';
import { mobileSchema } from './auth.js';

export const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const callInputSchema = z.object({
  title: z.string().trim().min(3, 'عنوان فراخوان را وارد کنید').max(300),
  description: z.string().trim().max(20000).default(''),
  departmentId: z.string().uuid().nullable().optional(),
  opensAt: z.coerce.date({ invalid_type_error: 'تاریخ شروع نامعتبر است' }),
  closesAt: z.coerce.date({ invalid_type_error: 'تاریخ پایان نامعتبر است' }),
  capacity: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  workflow: z.object({ interview: z.boolean(), minReviewers: z.coerce.number().int().min(1, 'حداقل یک داور').max(10) }),
  requiredDocuments: z.array(z.object({
    key: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, 'کلید مدرک باید لاتین و بدون فاصله باشد'),
    title: z.string().trim().min(2, 'عنوان مدرک را وارد کنید').max(200),
    mimeTypes: z.array(z.enum(ALLOWED_MIMES)).min(1, 'حداقل یک فرمت مجاز انتخاب کنید'),
    maxSizeMb: z.coerce.number().int().min(1).max(50),
    required: z.boolean(),
  })).max(30),
  criteria: z.array(z.object({
    title: z.string().trim().min(2, 'عنوان معیار را وارد کنید').max(200),
    category: z.string().trim().max(100).nullable().optional(),
    maxScore: z.coerce.number().int().min(1, 'سقف امتیاز باید مثبت باشد').max(1000),
    weight: z.coerce.number().min(0.1).max(100),
  })).max(50),
}).refine((v) => v.closesAt > v.opensAt, { message: 'تاریخ پایان باید بعد از تاریخ شروع باشد', path: ['closesAt'] })
  .refine((v) => new Set(v.requiredDocuments.map((d) => d.key)).size === v.requiredDocuments.length, { message: 'کلید مدارک تکراری است', path: ['requiredDocuments'] });
export type CallInput = z.infer<typeof callInputSchema>;

export const memberInputSchema = z.object({
  mobile: mobileSchema,
  fullName: z.string().trim().min(3, 'نام و نام خانوادگی را وارد کنید').max(120),
  role: z.enum(['committee_member', 'committee_chair']),
  specialization: z.string().trim().max(200).nullable().optional(),
  facultyId: z.string().uuid().nullable().optional(),
});

export const orgInputSchema = z.object({ name: z.string().trim().min(2, 'نام را وارد کنید').max(200), facultyId: z.string().uuid().optional() });
