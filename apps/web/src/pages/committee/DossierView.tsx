import { useState } from 'react';
import { RESUME_LABELS, RESUME_SECTIONS } from '@nezarat/shared';
import { Download, FileText } from 'lucide-react';
import { fa, fileSize, jDate } from '../../lib/format';
import type { Dossier } from '../../lib/types';
import { Card, CardContent, Segmented } from '../../components/ui';
import { RESUME_FIELDS } from '../applicant/resumeFields';

const MARITAL: Record<string, string> = { single: 'مجرد', married: 'متأهل', other: 'سایر' };
const GENDER: Record<string, string> = { male: 'مرد', female: 'زن' };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-left font-medium">{v || '—'}</span></div>;
}

function display(field: (typeof RESUME_FIELDS)['education'][number], v: string | number | null) {
  if (v == null || v === '') return null;
  if (field.type === 'select') return field.options?.find((o) => o[0] === v)?.[1] ?? String(v);
  if (field.type === 'date') return jDate(String(v));
  if (field.type === 'number') return fa(v);
  return String(v);
}

export function DossierView({ d }: { d: Dossier }) {
  const [tab, setTab] = useState<'profile' | 'resume' | 'docs'>('profile');
  const p = d.profile;
  return (
    <Card>
      <div className="border-b p-3">
        <Segmented label="بخش‌های پرونده" value={tab} onChange={setTab} options={[['profile', 'مشخصات'], ['resume', 'رزومهٔ علمی'], ['docs', `مدارک (${fa(d.documents.length)})`]]} />
      </div>
      <CardContent className="pt-4">
        {tab === 'profile' && (
          <div className="grid gap-x-8 md:grid-cols-2">
            <div><Row k="نام و نام خانوادگی" v={p ? `${p.firstName ?? ''} ${p.lastName ?? ''}` : d.applicant.fullName} /><Row k="نام پدر" v={p?.fatherName} /><Row k="کد ملی" v={fa(p?.nationalCode ?? '')} /><Row k="تاریخ تولد" v={jDate(p?.birthDate)} /><Row k="جنسیت" v={p?.gender && GENDER[p.gender]} /></div>
            <div><Row k="وضعیت تأهل" v={p?.maritalStatus && MARITAL[p.maritalStatus]} /><Row k="تعداد فرزندان" v={p?.family?.childrenCount != null ? fa(p.family.childrenCount) : null} /><Row k="محل سکونت" v={[p?.province, p?.city].filter(Boolean).join('، ')} /><Row k="موبایل" v={<span dir="ltr">{fa(d.applicant.mobile ?? '')}</span>} /><Row k="ایمیل" v={<span dir="ltr">{d.applicant.email}</span>} /></div>
          </div>
        )}
        {tab === 'resume' && (
          <div className="space-y-6">
            {RESUME_SECTIONS.map((s) => {
              const items = d.resume?.[s] ?? [];
              return (
                <section key={s}>
                  <h3 className="mb-2 flex items-center gap-2 font-bold">{RESUME_LABELS[s]}<span className="rounded-full bg-muted px-2 text-xs font-normal">{fa(items.length)}</span></h3>
                  {!items.length ? <p className="text-sm text-muted-foreground">موردی ثبت نشده است.</p> : (
                    <div className="space-y-2">
                      {items.map((it) => (
                        <div key={it.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                          {RESUME_FIELDS[s].map((f) => { const v = display(f, it[f.name]); return v ? <div key={f.name} className="flex gap-2"><span className="shrink-0 text-muted-foreground">{f.label}:</span><span dir={f.ltr ? 'ltr' : undefined}>{v}</span></div> : null; })}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
        {tab === 'docs' && (
          <div className="space-y-2">
            {!d.documents.length && <p className="text-sm text-muted-foreground">مدرکی بارگذاری نشده است.</p>}
            {d.documents.map((doc) => (
              <a key={doc.id} href={`/api/v1/documents/${doc.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted">
                <FileText className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><div className="truncate font-medium">{doc.originalName}</div><div className="text-xs text-muted-foreground">{fileSize(doc.size)} · {jDate(doc.createdAt)}</div></div><Download className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
