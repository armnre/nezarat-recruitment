import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, fa, jDate } from '../../lib/format';
import type { Assignment } from '../../lib/types';
import { Card, Input, Skeleton } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { PageTitle } from '../applicant/ApplicantLayout';

const TABS = [['open', 'در انتظار ارزیابی'], ['done', 'ارزیابی‌شده'], ['all', 'همه']] as const;
const STATE: Record<Assignment['status'], [string, string]> = {
  pending: ['جدید', 'bg-accent/15 text-accent-foreground'], in_progress: ['در حال ارزیابی', 'bg-primary/10 text-primary'], done: ['ارسال‌شده', 'bg-muted text-muted-foreground'],
};

export default function AssignmentsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['assignments'], queryFn: () => api<Assignment[]>('/committee/assignments') });
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('open');
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data ?? []).filter((a) =>
    (tab === 'all' || (tab === 'done' ? a.status === 'done' : a.status !== 'done')) &&
    (!q || `${a.applicantName} ${a.callTitle}`.includes(q.trim()))), [data, tab, q]);
  const openCount = (data ?? []).filter((a) => a.status !== 'done').length;

  return (
    <>
      <PageTitle title="کارتابل ارزیابی" sub={`${fa(openCount)} پرونده منتظر ارزیابی شماست`} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border bg-card p-1">
          {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('rounded px-3 py-1.5 text-sm', tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{l}</button>)}
        </div>
        <div className="relative w-full sm:w-72"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="جستجوی متقاضی یا فراخوان" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div> : !rows.length ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">پرونده‌ای در این بخش نیست.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const overdue = a.dueAt && a.status !== 'done' && new Date(a.dueAt) < new Date();
            return (
              <Link key={a.id} to={`/committee/applications/${a.applicationId}`}>
                <Card className="flex items-center gap-4 p-4 transition hover:border-primary/40 hover:shadow-md">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{a.applicantName || 'بدون نام'}</span><StatusBadge status={a.applicationStatus} /></div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">{a.callTitle}</div>
                  </div>
                  <div className="hidden text-left text-xs sm:block">
                    {a.dueAt && <div className={cn('flex items-center gap-1', overdue ? 'text-destructive' : 'text-muted-foreground')}><CalendarClock className="h-3.5 w-3.5" />مهلت {jDate(a.dueAt)}</div>}
                    {a.totalScore && a.status === 'done' && <div className="mt-1 font-bold text-foreground">امتیاز: {fa(Number(a.totalScore))} از ۱۰۰</div>}
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs', STATE[a.status][1])}>{STATE[a.status][0]}</span>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
