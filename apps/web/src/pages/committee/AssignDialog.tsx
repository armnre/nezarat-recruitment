import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { cn, fa } from '../../lib/format';
import type { CommitteeMember } from '../../lib/types';
import { Alert, Button, Field } from '../../components/ui';
import { Dialog } from '../../components/dialog';
import { JalaliDateInput } from '../../components/JalaliDateInput';

export function AssignDialog({ applicationId, exclude, open, onOpenChange }: { applicationId: string; exclude: string[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ['members'], queryFn: () => api<CommitteeMember[]>('/committee/members'), enabled: open });
  const [sel, setSel] = useState<string[]>([]);
  const [due, setDue] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/committee/applications/${applicationId}/assignments`, { method: 'POST', body: { memberIds: sel, dueAt: due } }),
    onSuccess: () => { setSel([]); setErr(''); onOpenChange(false); ['summary', 'queue', 'dossier', 'members'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'خطا'),
  });
  const list = (members.data ?? []).filter((x) => !exclude.includes(x.id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="تخصیص داور">
      <div className="space-y-4">
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {members.isLoading && <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>}
          {!members.isLoading && !list.length && <p className="text-sm text-muted-foreground">عضو فعال دیگری برای تخصیص وجود ندارد.</p>}
          {list.map((x) => {
            const on = sel.includes(x.id);
            return (
              <button key={x.id} type="button" onClick={() => setSel((s) => (on ? s.filter((i) => i !== x.id) : [...s, x.id]))}
                className={cn('flex w-full items-center justify-between rounded-md border p-3 text-right text-sm', on ? 'border-primary bg-primary/10' : 'hover:bg-muted')}>
                <span><span className="font-medium">{x.fullName || 'بدون نام'}</span>{x.specialization && <span className="block text-xs text-muted-foreground">{x.specialization}</span>}</span>
                <span className="text-xs text-muted-foreground">{fa(x.openCount)} پرونده باز</span>
              </button>
            );
          })}
        </div>
        <Field label="مهلت ارزیابی (اختیاری)"><JalaliDateInput value={due} onChange={setDue} minYear={1404} /></Field>
        {err && <Alert tone="error">{err}</Alert>}
        <Button className="w-full" disabled={!sel.length} loading={m.isPending} onClick={() => m.mutate()}>تخصیص {sel.length ? fa(sel.length) + ' داور' : ''}</Button>
      </div>
    </Dialog>
  );
}
