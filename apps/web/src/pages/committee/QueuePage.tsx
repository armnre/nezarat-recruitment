import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { STATUS_LABELS_FA, type ApplicationStatus } from '@nezarat/shared';
import { api } from '../../lib/api';
import { cn, fa, jDate } from '../../lib/format';
import type { QueueRow } from '../../lib/types';
import { Card, Input, Select, Skeleton } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { PageTitle } from '../applicant/ApplicantLayout';

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
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-72"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="جستجو" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <Select className="w-48" value={st} onChange={(e) => { setSt(e.target.value); setPage(0); }}><option value="">همهٔ وضعیت‌ها</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS_FA[s]}</option>)}</Select>
      </div>
      {isLoading ? <Skeleton className="h-64" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3 text-right font-medium">متقاضی</th><th className="p-3 text-right font-medium">فراخوان</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium">داوران</th><th className="p-3 font-medium">ارزیابی</th><th className="p-3 font-medium">امتیاز</th><th className="p-3 font-medium">ارسال</th></tr></thead>
            <tbody>
              {!view.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">پرونده‌ای یافت نشد</td></tr>}
              {view.map((r) => (
                <tr key={r.id} onClick={() => nav(`/committee/applications/${r.id}`)} className="cursor-pointer border-b last:border-0 hover:bg-muted/40">
                  <td className="p-3 font-medium">{r.applicantName || 'بدون نام'}</td><td className="p-3 text-muted-foreground">{r.callTitle}</td>
                  <td className="p-3 text-center"><StatusBadge status={r.status} /></td>
                  <td className={cn('p-3 text-center', r.assigned < r.minReviewers && r.status !== 'scored' && 'font-bold text-destructive')}>{fa(r.assigned)}</td>
                  <td className="p-3 text-center">{fa(r.evaluated)} / {fa(r.minReviewers)}</td>
                  <td className="p-3 text-center font-bold">{r.finalScore ? fa(Number(r.finalScore)) : '—'}</td>
                  <td className="p-3 text-center text-muted-foreground">{jDate(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > PER && (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <button disabled={!page} onClick={() => setPage((p) => p - 1)} className="rounded px-3 py-1 hover:bg-muted disabled:opacity-40">قبلی</button>
              <span className="text-muted-foreground">صفحهٔ {fa(page + 1)} از {fa(Math.ceil(rows.length / PER))}</span>
              <button disabled={(page + 1) * PER >= rows.length} onClick={() => setPage((p) => p + 1)} className="rounded px-3 py-1 hover:bg-muted disabled:opacity-40">بعدی</button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
