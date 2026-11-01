import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STATUS_LABELS_FA, type ApplicationStatus } from '@nezarat/shared';
import { api } from '../../lib/api';
import { cn, fa, jDate } from '../../lib/format';
import type { QueueRow } from '../../lib/types';
import { Card, DataTable, PageTitle, Pagination, SearchInput, Select, Skeleton, Toolbar } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';

const STATUSES: ApplicationStatus[] = ['screening', 'committee_review', 'interview', 'scored'];

export default function QueuePage() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['queue'], queryFn: () => api<QueueRow[]>('/committee/queue') });
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (data ?? []).filter((r) => (!st || r.status === st) && (!q || `${r.applicantName} ${r.callTitle}`.includes(q.trim()))), [data, q, st]);
  const PER = 20;
  const view = rows.slice(page * PER, page * PER + PER);
  const needAssign = (data ?? []).filter((r) => r.assigned < r.minReviewers && r.status !== 'scored').length;
  const ready = (data ?? []).filter((r) => r.evaluated >= r.minReviewers && r.status !== 'scored').length;

  return (
    <>
      <PageTitle title="مدیریت کمیته" sub="تخصیص داوران، پیگیری ارزیابی‌ها و ثبت امتیاز نهایی" />
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[['کل پرونده‌ها', data?.length ?? 0], ['نیازمند تخصیص داور', needAssign], ['آمادهٔ جمع‌بندی', ready]].map(([l, v]) => (
          <Card key={l as string} className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 text-2xl font-bold">{fa(v as number)}</div></Card>
        ))}
      </div>
      <Toolbar>
        <SearchInput label="جستجوی متقاضی یا فراخوان" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <Select aria-label="فیلتر وضعیت" value={st} onChange={(e) => { setSt(e.target.value); setPage(0); }}><option value="">همهٔ وضعیت‌ها</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS_FA[s]}</option>)}</Select>
      </Toolbar>
      {isLoading ? <Skeleton className="h-64" /> : (
        <Card className="overflow-hidden">
          <DataTable label="صف پرونده‌ها" minWidth={640}>
            <thead><tr><th className="p-3 text-right font-medium">متقاضی</th><th className="p-3 text-right font-medium">فراخوان</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium">داوران</th><th className="p-3 font-medium">ارزیابی</th><th className="p-3 font-medium">امتیاز</th><th className="p-3 font-medium">ارسال</th></tr></thead>
            <tbody>
              {!view.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">پرونده‌ای یافت نشد</td></tr>}
              {view.map((r) => (
                <tr key={r.id} onClick={() => nav(`/committee/applications/${r.id}`)} className="cursor-pointer border-b last:border-0 hover:bg-muted/40">
                  <td className="p-3 font-medium"><Link to={`/committee/applications/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">{r.applicantName || 'بدون نام'}</Link></td><td className="p-3 text-muted-foreground">{r.callTitle}</td>
                  <td className="p-3 text-center"><StatusBadge status={r.status} /></td>
                  <td className={cn('p-3 text-center', r.assigned < r.minReviewers && r.status !== 'scored' && 'font-bold text-destructive')}>{fa(r.assigned)}</td>
                  <td className="p-3 text-center">{fa(r.evaluated)} / {fa(r.minReviewers)}</td>
                  <td className="p-3 text-center font-bold">{r.finalScore ? fa(Number(r.finalScore)) : '—'}</td>
                  <td className="p-3 text-center text-muted-foreground">{jDate(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length > PER && (
            <Pagination page={page} hasNext={(page + 1) * PER < rows.length} onPage={setPage} total={rows.length} perPage={PER} />
          )}
        </Card>
      )}
    </>
  );
}
