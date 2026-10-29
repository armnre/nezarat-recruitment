import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Search } from 'lucide-react';
import { APPLICATION_STATUSES, STATUS_LABELS_FA } from '@nezarat/shared';
import { api } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import type { AdminCallRow, ApplicationRow } from '../../lib/types';
import { Card, Input, Select, Skeleton } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { PageTitle } from '../applicant/ApplicantLayout';

export default function ApplicationsAdminPage() {
  const nav = useNavigate();
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<ApplicationRow[]>('/applications') });
  const calls = useQuery({ queryKey: ['admin-calls'], queryFn: () => api<AdminCallRow[]>('/admin/calls') });
  const [q, setQ] = useState(''); const [st, setSt] = useState(''); const [call, setCall] = useState('');
  const [sort, setSort] = useState<'date' | 'score'>('date'); const [page, setPage] = useState(0);
  const rows = useMemo(() => (apps.data ?? [])
    .filter((a) => a.status !== 'draft' && (!st || a.status === st) && (!call || a.callId === call) && (!q || `${a.applicantName} ${a.callTitle}`.includes(q.trim())))
    .sort((a, b) => (sort === 'score' ? Number(b.finalScore ?? -1) - Number(a.finalScore ?? -1) : (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))), [apps.data, q, st, call, sort]);
  const PER = 25; const view = rows.slice(page * PER, page * PER + PER);
  const reset = () => setPage(0);
  return (
    <>
      <PageTitle title="پرونده‌ها" sub="بررسی اولیه، اعلام نقص، ارجاع به کمیته و تصمیم نهایی" />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-64"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="جستجوی متقاضی" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} /></div>
        <Select className="w-44" value={st} onChange={(e) => { setSt(e.target.value); reset(); }}><option value="">همهٔ وضعیت‌ها</option>{APPLICATION_STATUSES.filter((s) => s !== 'draft').map((s) => <option key={s} value={s}>{STATUS_LABELS_FA[s]}</option>)}</Select>
        <Select className="w-56" value={call} onChange={(e) => { setCall(e.target.value); reset(); }}><option value="">همهٔ فراخوان‌ها</option>{(calls.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
      </div>
      {apps.isLoading ? <Skeleton className="h-64" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr>
              <th className="p-3 text-right font-medium">متقاضی</th><th className="p-3 text-right font-medium">فراخوان</th><th className="p-3 font-medium">وضعیت</th>
              <th className="p-3 font-medium"><button onClick={() => setSort('score')} className="inline-flex items-center gap-1">امتیاز<ArrowUpDown className="h-3 w-3" /></button></th>
              <th className="p-3 font-medium"><button onClick={() => setSort('date')} className="inline-flex items-center gap-1">تاریخ ارسال<ArrowUpDown className="h-3 w-3" /></button></th>
            </tr></thead>
            <tbody>
              {!view.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">پرونده‌ای یافت نشد</td></tr>}
              {view.map((a) => (
                <tr key={a.id} onClick={() => nav(`/admin/applications/${a.id}`)} className="cursor-pointer border-b last:border-0 hover:bg-muted/40">
                  <td className="p-3 font-medium">{a.applicantName || 'بدون نام'}</td><td className="p-3 text-muted-foreground">{a.callTitle}</td>
                  <td className="p-3 text-center"><StatusBadge status={a.status} /></td>
                  <td className="p-3 text-center font-bold">{a.finalScore ? fa(Number(a.finalScore)) : '—'}</td>
                  <td className="p-3 text-center text-muted-foreground">{jDate(a.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > PER && (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <button disabled={!page} onClick={() => setPage((p) => p - 1)} className="rounded px-3 py-1 hover:bg-muted disabled:opacity-40">قبلی</button>
              <span className="text-muted-foreground">{fa(rows.length)} پرونده · صفحهٔ {fa(page + 1)}</span>
              <button disabled={(page + 1) * PER >= rows.length} onClick={() => setPage((p) => p + 1)} className="rounded px-3 py-1 hover:bg-muted disabled:opacity-40">بعدی</button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
