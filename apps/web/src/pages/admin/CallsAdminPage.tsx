import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { cn, fa, jDate } from '../../lib/format';
import type { AdminCallRow } from '../../lib/types';
import { Alert, Card, DataTable, EmptyState, LinkButton, SearchInput, Select, Skeleton, PageTitle, Toolbar } from '../../components/ui';
import { ConfirmDialog } from '../../components/dialog';

export const CALL_STATUS: Record<AdminCallRow['status'], [string, string]> = {
  draft: ['پیش‌نویس', 'bg-muted text-muted-foreground'], published: ['منتشرشده', 'bg-primary/10 text-primary'], closed: ['بسته‌شده', 'bg-destructive/10 text-destructive'],
};

export default function CallsAdminPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-calls'], queryFn: () => api<AdminCallRow[]>('/admin/calls') });
  const [q, setQ] = useState('');
  const [del, setDel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-calls'] });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api(`/admin/calls/${id}/status`, { method: 'POST', body: { status } }), onSuccess: () => { setErr(''); refresh(); }, onError: (e) => setErr(e instanceof ApiError ? e.message : 'خطا') });
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/calls/${id}`, { method: 'DELETE' }), onSuccess: () => { setDel(null); refresh(); }, onError: (e) => { setDel(null); setErr(e instanceof ApiError ? e.message : 'خطا'); } });
  const rows = (data ?? []).filter((c) => !q || c.title.includes(q.trim()));

  return (
    <>
      <PageTitle title="فراخوان‌ها" sub="تعریف فراخوان، مدارک لازم و معیارهای امتیازدهی" action={<LinkButton to="/admin/calls/new"><Plus className="h-4 w-4" aria-hidden />فراخوان جدید</LinkButton>} />
      <Toolbar><SearchInput label="جستجوی عنوان فراخوان" value={q} onChange={(e) => setQ(e.target.value)} /></Toolbar>
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      {isLoading ? <Skeleton className="h-64" /> : !rows.length ? (
        <Card><EmptyState icon={Megaphone} title={q ? 'فراخوانی با این عنوان یافت نشد' : 'هنوز فراخوانی تعریف نشده است'}>{!q && <LinkButton to="/admin/calls/new" variant="outline" size="sm" className="mt-2">ایجاد نخستین فراخوان</LinkButton>}</EmptyState></Card>
      ) : (
        <Card className="overflow-hidden">
          <DataTable label="فهرست فراخوان‌ها" minWidth={720}>
            <thead><tr><th className="text-right">عنوان</th><th>بازهٔ ثبت‌نام</th><th>درخواست‌ها</th><th>وضعیت</th><th><span className="sr-only">عملیات</span></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/admin/calls/${c.id}`} className="font-medium hover:text-primary hover:underline">{c.title}</Link>{c.departmentName && <div className="text-xs text-muted-foreground">{c.departmentName}</div>}</td>
                  <td className="text-center text-xs text-muted-foreground">{jDate(c.opensAt)} تا {jDate(c.closesAt)}</td>
                  <td className="text-center tabular">{fa(c.applications)}</td>
                  <td className="text-center">
                    <Select aria-label={`وضعیت ${c.title}`} className={cn('mx-auto h-8 w-32 text-xs font-medium', CALL_STATUS[c.status][1])} value={c.status} onChange={(e) => setStatus.mutate({ id: c.id, status: e.target.value })}>
                      {Object.entries(CALL_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  </td>
                  <td><div className="flex justify-end gap-1">
                    <Link to={`/admin/calls/${c.id}`} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`ویرایش ${c.title}`}><Pencil className="h-4 w-4" /></Link>
                    {!c.applications && <button onClick={() => setDel(c.id)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`حذف ${c.title}`}><Trash2 className="h-4 w-4" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      )}
      <ConfirmDialog open={!!del} onOpenChange={() => setDel(null)} title="حذف فراخوان" description="این فراخوان برای همیشه حذف می‌شود. ادامه می‌دهید؟" confirmText="حذف" loading={remove.isPending} onConfirm={() => del && remove.mutate(del)} />
    </>
  );
}
