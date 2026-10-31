import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Building2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { daysLeft, fa, jDate } from '../../lib/format';
import type { ApplicationRow, PublicCall } from '../../lib/types';
import { Card, Input, Skeleton } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { PageTitle } from './ApplicantLayout';

export default function CallsPage() {
  const [q, setQ] = useState('');
  const { data: me } = useMe();
  const slug = me?.tenant?.slug;
  const calls = useQuery({ queryKey: ['public-calls', slug], enabled: !!slug, queryFn: () => api<PublicCall[]>(`/public/${slug}/calls`) });
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<ApplicationRow[]>('/applications') });
  const list = (calls.data ?? []).filter((c) => !q || `${c.title} ${c.facultyName ?? ''} ${c.departmentName ?? ''}`.includes(q));

  return (
    <>
      <PageTitle title="فراخوان‌های فعال" sub="فراخوان مناسب را انتخاب و درخواست خود را ثبت کنید."
        action={<div className="relative w-full sm:w-64"><Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" /><Input className="pr-10" placeholder="جستجو در فراخوان‌ها" value={q} onChange={(e) => setQ(e.target.value)} /></div>} />
      {calls.isLoading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        : !list.length ? <p className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">{q ? 'فراخوانی با این عبارت یافت نشد.' : 'در حال حاضر فراخوان فعالی وجود ندارد.'}</p>
        : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((c) => {
              const mine = apps.data?.find((a) => a.callId === c.id);
              const left = daysLeft(c.closesAt);
              return (
                <Link key={c.id} to={`/applicant/calls/${c.id}`}>
                  <Card className="h-full p-5 transition-shadow hover:shadow-lg">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h2 className="font-bold leading-relaxed">{c.title}</h2>
                      {mine ? <StatusBadge status={mine.status} /> : left <= 7 && <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">{fa(left)} روز مانده</span>}
                    </div>
                    {(c.facultyName || c.departmentName) && <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />{[c.facultyName, c.departmentName].filter(Boolean).join(' — ')}</p>}
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                    <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="h-4 w-4" />مهلت ثبت‌نام: {jDate(c.closesAt)}{c.capacity ? ` · ظرفیت ${fa(c.capacity)} نفر` : ''}</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
    </>
  );
}
