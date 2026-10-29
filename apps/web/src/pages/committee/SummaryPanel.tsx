import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gavel, UserPlus, X } from 'lucide-react';
import { RECOMMENDATION_LABELS_FA, type Recommendation } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import type { Dossier, Summary } from '../../lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/dialog';
import { AssignDialog } from './AssignDialog';

export function SummaryPanel({ d }: { d: Dossier }) {
  const id = d.application.id;
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ['summary', id], queryFn: () => api<Summary>(`/committee/applications/${id}/summary`) });
  const [assign, setAssign] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  const [fin, setFin] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const refresh = () => ['summary', 'queue', 'dossier', 'members'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const onError = (e: unknown) => setErr(e instanceof ApiError ? e.message : 'خطا');
  const del = useMutation({ mutationFn: (aid: string) => api(`/committee/assignments/${aid}`, { method: 'DELETE' }), onSuccess: () => { setRemove(null); refresh(); }, onError: (e) => { setRemove(null); onError(e); } });
  const finalize = useMutation({ mutationFn: () => api(`/committee/applications/${id}/finalize`, { method: 'POST', body: { note: note || undefined } }), onSuccess: () => { setFin(false); setErr(''); refresh(); }, onError: (e) => { setFin(false); onError(e); } });

  if (s.isLoading || !s.data) return <Skeleton className="h-64" />;
  const sum = s.data;
  const min = d.call.workflow.minReviewers;
  const st = d.application.status;
  const canAssign = ['screening', 'committee_review', 'interview'].includes(st);
  const canFinalize = d.canManage && ['committee_review', 'interview'].includes(st);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>جمع‌بندی کمیته</CardTitle>
        {canAssign && <Button size="sm" variant="outline" onClick={() => setAssign(true)}><UserPlus className="h-4 w-4" />تخصیص داور</Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-md bg-secondary p-3"><div className="text-xs text-muted-foreground">میانگین امتیاز</div><div className="text-2xl font-bold text-primary">{sum.average == null ? '—' : fa(sum.average)}</div></div>
          <div className="rounded-md bg-secondary p-3"><div className="text-xs text-muted-foreground">ارزیابی ارسال‌شده</div><div className="text-2xl font-bold">{fa(sum.submittedCount)}<span className="text-sm font-normal text-muted-foreground"> / حداقل {fa(min)}</span></div></div>
        </div>
        {d.application.finalScore && <Alert tone="success">امتیاز نهایی ثبت‌شده: {fa(Number(d.application.finalScore))}</Alert>}
        <div className="space-y-2">
          {!sum.reviewers.length && <p className="text-sm text-muted-foreground">هنوز داوری تخصیص داده نشده است.</p>}
          {sum.reviewers.map((r) => (
            <div key={r.assignmentId} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.reviewer || 'بدون نام'}</span>
                <span className="flex items-center gap-2">
                  {r.submittedAt ? <span className="font-bold text-primary">{fa(Number(r.totalScore))}</span> : <span className="text-xs text-muted-foreground">{r.status === 'in_progress' ? 'در حال ارزیابی' : 'در انتظار'}{r.dueAt && ` · مهلت ${jDate(r.dueAt)}`}</span>}
                  {!r.evaluationId && canAssign && <button onClick={() => setRemove(r.assignmentId)} aria-label="حذف تخصیص" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
                </span>
              </div>
              {r.submittedAt && r.recommendation && <div className="mt-1 text-xs text-muted-foreground">پیشنهاد: {RECOMMENDATION_LABELS_FA[r.recommendation as Recommendation]}</div>}
              {r.submittedAt && r.comment && <p className="mt-2 whitespace-pre-line rounded bg-muted/50 p-2 text-xs leading-6">{r.comment}</p>}
            </div>
          ))}
        </div>
        {sum.submittedCount > 0 && (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="py-1 text-right font-normal">معیار</th><th className="font-normal">سقف</th><th className="font-normal">میانگین</th></tr></thead>
            <tbody>{sum.criteria.map((c) => <tr key={c.id} className="border-t"><td className="py-1.5">{c.title}</td><td className="text-center">{fa(c.maxScore)}</td><td className="text-center font-medium">{c.average == null ? '—' : fa(c.average)}</td></tr>)}</tbody></table></div>
        )}
        {err && <Alert tone="error">{err}</Alert>}
        {canFinalize && <Button className="w-full" disabled={sum.submittedCount < min} onClick={() => setFin(true)}><Gavel className="h-4 w-4" />ثبت امتیاز نهایی کمیته</Button>}
      </CardContent>
      <AssignDialog applicationId={id} exclude={sum.reviewers.map((r) => r.memberId)} open={assign} onOpenChange={setAssign} />
      <ConfirmDialog open={!!remove} onOpenChange={() => setRemove(null)} title="حذف تخصیص" description="این داور از پرونده حذف شود؟" confirmText="حذف" loading={del.isPending} onConfirm={() => remove && del.mutate(remove)} />
      <Dialog open={fin} onOpenChange={setFin} title="ثبت امتیاز نهایی">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">میانگین {fa(sum.average ?? 0)} به‌عنوان امتیاز نهایی ثبت و وضعیت پرونده «امتیازدهی‌شده» می‌شود.</p>
          <Textarea rows={3} placeholder="توضیح کمیته (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" loading={finalize.isPending} onClick={() => finalize.mutate()}>تأیید و ثبت</Button>
        </div>
      </Dialog>
    </Card>
  );
}
