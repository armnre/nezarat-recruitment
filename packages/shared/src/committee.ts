import { z } from 'zod';
import { toLatinDigits } from './auth.js';

export const RECOMMENDATIONS = ['accept', 'interview', 'reserve', 'reject'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];
export const RECOMMENDATION_LABELS_FA: Record<Recommendation, string> = {
  accept: 'پیشنهاد جذب', interview: 'نیاز به مصاحبه', reserve: 'ذخیره', reject: 'عدم پذیرش',
};

const scoreValue = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : Number(toLatinDigits(v.trim()))) : v),
  z.number({ required_error: 'امتیاز را وارد کنید', invalid_type_error: 'امتیاز باید عدد باشد' }).min(0, 'امتیاز نمی‌تواند منفی باشد'),
);

export const evaluationSchema = z.object({
  scores: z.array(z.object({ criterionId: z.string().uuid(), score: scoreValue })).max(100),
  comment: z.string().trim().max(5000, 'نظر بیش از حد طولانی است').optional().nullable(),
  recommendation: z.enum(RECOMMENDATIONS).optional().nullable(),
  submit: z.boolean().default(false),
});
export type EvaluationInput = z.infer<typeof evaluationSchema>;

export const assignSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1, 'حداقل یک داور انتخاب کنید').max(20),
  dueAt: z.coerce.date().optional().nullable(),
});

/** Weighted total normalised to 100: Σ(score/max·weight) / Σweight · 100. */
export function weightedTotal(rows: { score: number; maxScore: number; weight: number }[]) {
  const w = rows.reduce((s, r) => s + r.weight, 0);
  if (!w) return 0;
  const v = rows.reduce((s, r) => s + (r.maxScore ? (r.score / r.maxScore) * r.weight : 0), 0);
  return Math.round((v / w) * 10000) / 100;
}
