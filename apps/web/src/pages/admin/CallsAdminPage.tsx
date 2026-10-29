import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { cn, fa, jDate } from '../../lib/format';
import type { AdminCallRow } from '../../lib/types';
import { Alert, Card, Input, LinkButton, Select, Skeleton } from '../../components/ui';
import { ConfirmDialog } from '../../components/dialog';
import { PageTitle } from '../applicant/ApplicantLayout';

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
      <PageTitle title="فراخوان‌ها" sub="تعریف فراخوان، مدارک لازم و معیارهای امتیازدهی" action={<LinkButton to="/admin/calls/new"><Plus className="h-4 w-4" />فراخوان جدید</LinkButton>} />
      <div className="relative mb-4 w-full sm:w-72"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="جستجوی عنوان" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      {isLoading ? <Skeleton className="h-64" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3 text-right font-medium">عنوان</th><th className="p-3 font-medium">بازه</th><th className="p-3 font-medium">درخواست‌ها</th><th className="p-3 font-medium">وضعیت</th><th className="p-3" /></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">فراخوانی وجود ندارد</td></tr>}
              {rows.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3"><Link to={`/admin/calls/${c.id}`} className="font-medium hover:text-primary">{c.title}</Link>{c.departmentName && <div className="text-xs text-muted-foreground">{c.departmentName}</div>}</td>
                  <td className="p-3 text-center text-xs text-muted-foreground">{jDate(c.opensAt)} تا {jDate(c.closesAt)}</td>
                  <td className="p-3 text-center">{fa(c.applications)}</td>
                  <td className="p-3 text-center">
                    <Select aria-label="وضعیت فراخوان" className={cn('h-8 w-32 text-xs', CALL_STATUS[c.status][1])} value={c.status} onChange={(e) => setStatus.mutate({ id: c.id, status: e.target.value })}>
                      {Object.entries(CALL_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  </td>
                  <td className="p-3"><div className="flex justify-end gap-1">
                    <Link to={`/admin/calls/${c.id}`} className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="ویرایش"><Pencil className="h-4 w-4" /></Link>
                    {!c.applications && <button onClick={() => setDel(c.id)} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ConfirmDialog open={!!del} onOpenChange={() => setDel(null)} title="حذف فراخوان" description="این فراخوان حذف شود؟" confirmText="حذف" loading={remove.isPending} onConfirm={() => del && remove.mutate(del)} />
    </>
  );
}
