import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isoToJalali, JALALI_MONTHS } from '@nezarat/shared';

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

const faNum = new Intl.NumberFormat('fa-IR', { useGrouping: false });
const faGrouped = new Intl.NumberFormat('fa-IR');
/** Persian digits in any string. */
export const fa = (v: string | number | null | undefined) =>
  v == null ? '' : String(v).replace(/\d/g, (d) => faNum.format(Number(d)));
export const faMoney = (n: number | string | null | undefined) => (n == null || n === '' ? '' : faGrouped.format(Number(n)));

const tz = 'Asia/Tehran';
/** Gregorian ISO date/datetime (UTC) → Persian Jalali text. */
export function jDate(v: string | Date | null | undefined, withTime = false) {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v.length === 10 ? `${v}T12:00:00Z` : v) : v;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {});
  const j = isoToJalali(`${parts.year}-${parts.month}-${parts.day}`);
  const date = `${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${fa(j.jy)}`;
  return withTime ? `${date}، ساعت ${fa(`${parts.hour}:${parts.minute}`)}` : date;
}

export function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
export const fileSize = (b: number) => (b < 1024 * 1024 ? `${fa(Math.ceil(b / 1024))} کیلوبایت` : `${fa((b / 1048576).toFixed(1))} مگابایت`);
