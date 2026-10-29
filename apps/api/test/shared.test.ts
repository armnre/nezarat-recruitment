import { describe, expect, it } from 'vitest';
import { isoToJalali, isValidNationalCode, jalaliMonthLength, jalaliToIso, resumeSchemas } from '@nezarat/shared';

describe('تقویم شمسی', () => {
  it('تبدیل دوطرفه', () => {
    expect(isoToJalali('2025-03-21')).toEqual({ jy: 1404, jm: 1, jd: 1 });
    expect(isoToJalali('2026-10-30')).toEqual({ jy: 1405, jm: 8, jd: 8 });
    expect(jalaliToIso(1403, 12, 30)).toBe('2025-03-20');
  });
  it('اسفند سال کبیسه', () => {
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });
});

describe('اعتبارسنجی', () => {
  it('کد ملی', () => {
    expect(isValidNationalCode('0013542419')).toBe(true);
    expect(isValidNationalCode('۰۰۱۳۵۴۲۴۱۹')).toBe(true);
    expect(isValidNationalCode('1111111111')).toBe(false);
    expect(isValidNationalCode('1234567890')).toBe(false);
  });
  it('فیلد عددی خالی به null تبدیل می‌شود', () => {
    const r = resumeSchemas.publications.parse({ type: 'journal', title: 'یک مقاله', year: '', doi: '' });
    expect(r.year).toBeNull();
    expect(r.doi).toBeNull();
    expect(resumeSchemas.publications.safeParse({ type: 'journal', title: 'یک مقاله', year: '۱۴۰۳' }).success).toBe(true);
  });
});
