import { describe, expect, it } from 'vitest';
import { canTransition, normalizeMobile, mobileSchema } from '@nezarat/shared';

describe('گردش وضعیت پرونده', () => {
  it('انتقال‌های مجاز', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('screening', 'incomplete')).toBe(true);
    expect(canTransition('incomplete', 'submitted')).toBe(true);
    expect(canTransition('scored', 'accepted')).toBe(true);
  });
  it('انتقال‌های غیرمجاز', () => {
    expect(canTransition('draft', 'accepted')).toBe(false);
    expect(canTransition('accepted', 'rejected')).toBe(false);
    expect(canTransition('scored', 'withdrawn')).toBe(false);
  });
  it('مصاحبه در فراخوان بدون مصاحبه ممنوع است', () => {
    expect(canTransition('committee_review', 'interview', { interview: false })).toBe(false);
  });
});

describe('نرمال‌سازی موبایل', () => {
  it('ارقام فارسی و پیشوند +98', () => {
    expect(normalizeMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizeMobile('+989123456789')).toBe('09123456789');
    expect(mobileSchema.safeParse('0812').success).toBe(false);
  });
});
