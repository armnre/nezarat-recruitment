import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { memberInputSchema } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { cn, fa } from '../../lib/format';
import type { AdminMember } from '../../lib/types';
import { Alert, Button, Card, Field, Input, Select, Skeleton } from '../../components/ui';
import { Dialog } from '../../components/dialog';
import { PageTitle } from '../applicant/ApplicantLayout';

function AddMember({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ fullName: '', mobile: '', role: 'committee_member', specialization: '' });
  const [err, setErr] = useState('');
  const m = useMutation({
    mutationFn: (b: unknown) => api('/admin/members', { method: 'POST', body: b }),
    onSuccess: () => { setF({ fullName: '', mobile: '', role: 'committee_member', specialization: '' }); setErr(''); onOpenChange(false); qc.invalidateQueries({ queryKey: ['admin-members'] }); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'خطا'),
  });
  const submit = () => {
    const p = memberInputSchema.safeParse({ ...f, specialization: f.specialization || null });
    if (!p.success) return setErr(p.error.issues[0]?.message ?? 'اطلاعات نامعتبر');
    m.mutate(p.data);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="افزودن عضو کمیته">
      <div className="space-y-4">
        <Field label="نام و نام خانوادگی"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="شمارهٔ موبایل" hint="عضو با همین شماره و کد یک‌بارمصرف وارد سامانه می‌شود"><Input dir="ltr" inputMode="tel" placeholder="09xxxxxxxxx" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></Field>
        <Field label="نقش"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="committee_member">عضو کمیته</option><option value="committee_chair">رئیس کمیته</option></Select></Field>
        <Field label="تخصص (اختیاری)"><Input value={f.specialization} onChange={(e) => setF({ ...f, specialization: e.target.value })} /></Field>
        {err && <Alert tone="error">{err}</Alert>}
        <Button className="w-full" loading={m.isPending} onClick={submit}>افزودن</Button>
      </div>
    </Dialog>
  );
}

export default function MembersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-members'], queryFn: () => api<AdminMember[]>('/admin/members') });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const upd = useMutation({
    mutationFn: ({ id, ...b }: { id: string; active?: boolean; role?: string }) => api(`/admin/members/${id}`, { method: 'PATCH', body: b }),
    onSuccess: () => { setErr(''); qc.invalidateQueries({ queryKey: ['admin-members'] }); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'خطا'),
  });
  const rows = (data ?? []).filter((m) => !q || `${m.fullName} ${m.mobile}`.includes(q.trim()));
  return (
    <>
      <PageTitle title="اعضای کمیته" sub="داوران و رئیس کمیتهٔ جذب" action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />افزودن عضو</Button>} />
      <div className="relative mb-4 w-full sm:w-72"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="جستجوی نام یا موبایل" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      {isLoading ? <Skeleton className="h-64" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3 text-right font-medium">نام</th><th className="p-3 font-medium">موبایل</th><th className="p-3 font-medium">نقش</th><th className="p-3 font-medium">باز / انجام‌شده</th><th className="p-3 font-medium">وضعیت</th></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">عضوی ثبت نشده است</td></tr>}
              {rows.map((m) => (
                <tr key={m.id} className={cn('border-b last:border-0', !m.active && 'text-muted-foreground')}>
                  <td className="p-3"><div className="font-medium">{m.fullName || '—'}</div>{m.specialization && <div className="text-xs text-muted-foreground">{m.specialization}</div>}</td>
                  <td className="p-3 text-center" dir="ltr">{fa(m.mobile ?? '')}</td>
                  <td className="p-3 text-center"><Select className="h-8 w-32 text-xs" disabled={!m.active} value={m.isChair ? 'committee_chair' : 'committee_member'} onChange={(e) => upd.mutate({ id: m.id, role: e.target.value })}><option value="committee_member">عضو</option><option value="committee_chair">رئیس</option></Select></td>
                  <td className="p-3 text-center">{fa(m.openCount)} / {fa(m.doneCount)}</td>
                  <td className="p-3 text-center"><Button size="sm" variant={m.active ? 'outline' : 'secondary'} onClick={() => upd.mutate({ id: m.id, active: !m.active })}>{m.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <AddMember open={open} onOpenChange={setOpen} />
    </>
  );
}
