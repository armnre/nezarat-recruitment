import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { canTransition, STATUS_LABELS_FA, type ApplicationStatus } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { jDate } from '../../lib/format';
import type { Dossier, HistoryRow } from '../../lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Textarea } from '../../components/ui';
import { Dialog } from '../../components/dialog';

/** Staff status moves. «scored» goes through the committee finalize flow, so it's not offered here. */
const STAFF_MOVES: ApplicationStatus[] = ['screening', 'incomplete', 'committee_review', 'interview', 'accepted', 'reserve', 'rejected'];
const NEEDS_NOTE: ApplicationStatus[] = ['incomplete', 'rejected'];

export function StatusActions({ d }: { d: Dossier }) {
  const qc = useQueryClient();
  const id = d.application.id;
  const hist = useQuery({ queryKey: ['history', id], queryFn: () => api<HistoryRow[]>(`/applications/${id}/history`) });
  const [to, setTo] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const moves = STAFF_MOVES.filter((s) => canTransition(d.application.status, s, { interview: d.call.workflow.interview }));
  const m = useMutation({
    mutationFn: () => api(`/applications/${id}/status`, { method: 'POST', body: { to, note: note || undefined } }),
    onSuccess: () => { setTo(null); setNote(''); setErr(''); ['dossier', 'history', 'applications', 'queue', 'admin-stats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'خطا'),
  });
  return (
    <Card>
      <CardHeader><CardTitle>گردش پرونده</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {moves.length ? <div className="flex flex-wrap gap-2">{moves.map((s) => <Button key={s} size="sm" variant={s === 'rejected' ? 'destructive' : s === 'accepted' ? 'default' : 'outline'} onClick={() => { setErr(''); setTo(s); }}>{STATUS_LABELS_FA[s]}</Button>)}</div>
          : <p className="text-sm text-muted-foreground">اقدامی برای این وضعیت وجود ندارد.</p>}
        <ol className="space-y-2 border-r pr-4 text-sm">
          {(hist.data ?? []).map((h) => (
            <li key={h.id}><span className="font-medium">{STATUS_LABELS_FA[h.toStatus]}</span><span className="mr-2 text-xs text-muted-foreground">{jDate(h.createdAt, true)}</span>{h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}</li>
          ))}
        </ol>
      </CardContent>
      <Dialog open={!!to} onOpenChange={() => setTo(null)} title={`تغییر وضعیت به «${to ? STATUS_LABELS_FA[to] : ''}»`}>
        <div className="space-y-4">
          <Textarea rows={3} placeholder={to && NEEDS_NOTE.includes(to) ? 'توضیح برای متقاضی (الزامی)' : 'توضیح (اختیاری)'} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-xs text-muted-foreground">متقاضی از طریق پیامک و ایمیل مطلع می‌شود.</p>
          {err && <Alert tone="error">{err}</Alert>}
          <Button className="w-full" disabled={!!to && NEEDS_NOTE.includes(to) && note.trim().length < 3} loading={m.isPending} onClick={() => m.mutate()}>تأیید</Button>
        </div>
      </Dialog>
    </Card>
  );
}
