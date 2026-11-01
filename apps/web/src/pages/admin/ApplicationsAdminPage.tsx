import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, FileSearch } from 'lucide-react';
import { APPLICATION_STATUSES, STATUS_LABELS_FA } from '@nezarat/shared';
import { api } from '../../lib/api';
import { cn, fa, jDate } from '../../lib/format';
import type { AdminCallRow, ApplicationRow } from '../../lib/types';
import { Card, DataTable, EmptyState, Pagination, SearchInput, Select, Skeleton, PageTitle, Toolbar } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';

function SortTh({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <th aria-sort={active ? 'descending' : 'none'}>
      <button onClick={onClick} className={cn('inline-flex items-center gap-1 rounded hover:text-foreground', active && 'text-foreground')}>
        {children}<ArrowDown className={cn('h-3 w-3', !active && 'opacity-30')} aria-hidden />
      </button>
    </th>
  );
}

export default function ApplicationsAdminPage() {
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
      <PageTitle title="پرونده‌ها" sub="بررسی اولیه، اعلام نقص، ارجاع به کمیته و تصمیم نهایی" action={!apps.isLoading && <span className="text-sm text-muted-foreground">{fa(rows.length)} پرونده</span>} />
      <Toolbar>
        <SearchInput label="جستجوی متقاضی یا فراخوان" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        <Select aria-label="فیلتر وضعیت" value={st} onChange={(e) => { setSt(e.target.value); reset(); }}><option value="">همهٔ وضعیت‌ها</option>{APPLICATION_STATUSES.filter((s) => s !== 'draft').map((s) => <option key={s} value={s}>{STATUS_LABELS_FA[s]}</option>)}</Select>
        <Select aria-label="فیلتر فراخوان" value={call} onChange={(e) => { setCall(e.target.value); reset(); }}><option value="">همهٔ فراخوان‌ها</option>{(calls.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
      </Toolbar>
      {apps.isLoading ? <Skeleton className="h-64" /> : !rows.length ? <Card><EmptyState icon={FileSearch} title="پرونده‌ای یافت نشد">فیلترها را تغییر دهید.</EmptyState></Card> : (
        <Card className="overflow-hidden">
          <DataTable label="فهرست پرونده‌ها">
            <thead><tr>
              <th className="text-right">متقاضی</th><th className="text-right">فراخوان</th><th>وضعیت</th>
              <SortTh active={sort === 'score'} onClick={() => setSort('score')}>امتیاز</SortTh>
              <SortTh active={sort === 'date'} onClick={() => setSort('date')}>تاریخ ارسال</SortTh>
            </tr></thead>
            <tbody>
              {view.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/admin/applications/${a.id}`} className="font-medium hover:text-primary hover:underline">{a.applicantName || 'بدون نام'}</Link></td>
                  <td className="text-muted-foreground">{a.callTitle}</td>
                  <td className="text-center"><StatusBadge status={a.status} /></td>
                  <td className="text-center font-bold tabular">{a.finalScore ? fa(Number(a.finalScore)) : '—'}</td>
                  <td className="text-center text-muted-foreground">{jDate(a.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page} hasNext={(page + 1) * PER < rows.length} onPage={setPage} total={rows.length} perPage={PER} />
        </Card>
      )}
    </>
  );
}
