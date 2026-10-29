import { isoToJalali, jalaliMonthLength, jalaliToIso, JALALI_MONTHS, toJalali } from '@nezarat/shared';
import { fa } from '../lib/format';
import { Select } from './ui';

/** Jalali date picker; value/onChange are Gregorian ISO 'YYYY-MM-DD' (what the API stores). */
export function JalaliDateInput({ value, onChange, minYear = 1320, maxYear, invalid }: {
  value?: string | null; onChange: (iso: string | null) => void; minYear?: number; maxYear?: number; invalid?: boolean;
}) {
  const now = new Date();
  const thisJy = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate()).jy;
  const top = maxYear ?? thisJy + 5;
  const j = value ? isoToJalali(value) : null;

  const update = (jy?: number, jm?: number, jd?: number) => {
    if (!jy || !jm || !jd) return onChange(null);
    onChange(jalaliToIso(jy, jm, Math.min(jd, jalaliMonthLength(jy, jm))));
  };
  const years = Array.from({ length: top - minYear + 1 }, (_, i) => top - i);
  const days = Array.from({ length: j ? jalaliMonthLength(j.jy, j.jm) : 31 }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-2" aria-invalid={invalid}>
      <Select aria-label="روز" value={j?.jd ?? ''} aria-invalid={invalid} onChange={(e) => update(j?.jy ?? thisJy, j?.jm ?? 1, Number(e.target.value))}>
        <option value="">روز</option>
        {days.map((d) => <option key={d} value={d}>{fa(d)}</option>)}
      </Select>
      <Select aria-label="ماه" value={j?.jm ?? ''} aria-invalid={invalid} onChange={(e) => update(j?.jy ?? thisJy, Number(e.target.value), j?.jd ?? 1)}>
        <option value="">ماه</option>
        {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </Select>
      <Select aria-label="سال" value={j?.jy ?? ''} aria-invalid={invalid} onChange={(e) => update(Number(e.target.value), j?.jm ?? 1, j?.jd ?? 1)}>
        <option value="">سال</option>
        {years.map((y) => <option key={y} value={y}>{fa(y)}</option>)}
      </Select>
    </div>
  );
}
