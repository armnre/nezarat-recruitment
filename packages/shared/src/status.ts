import { z } from 'zod';

export const APPLICATION_STATUSES = [
  'draft', 'submitted', 'screening', 'incomplete', 'committee_review', 'interview', 'scored', 'accepted', 'rejected', 'reserve', 'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);

export const STATUS_LABELS_FA: Record<ApplicationStatus, string> = {
  draft: 'پیش‌نویس', submitted: 'ارسال‌شده', screening: 'بررسی اولیه', incomplete: 'نقص مدارک',
  committee_review: 'بررسی کمیته', interview: 'مصاحبه', scored: 'امتیازدهی‌شده',
  accepted: 'پذیرفته‌شده', rejected: 'ردشده', reserve: 'ذخیره', withdrawn: 'انصراف',
};

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['screening', 'withdrawn'],
  screening: ['incomplete', 'committee_review', 'rejected', 'withdrawn'],
  incomplete: ['submitted', 'withdrawn'],
  committee_review: ['interview', 'scored', 'withdrawn'],
  interview: ['scored', 'withdrawn'],
  scored: ['accepted', 'rejected', 'reserve'],
  accepted: [], rejected: [], reserve: ['accepted', 'rejected'], withdrawn: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus, opts: { interview: boolean } = { interview: true }) {
  if (!opts.interview && to === 'interview') return false;
  return TRANSITIONS[from].includes(to);
}
