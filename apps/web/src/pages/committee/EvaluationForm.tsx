import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Save, Send } from 'lucide-react';
import { RECOMMENDATION_LABELS_FA, RECOMMENDATIONS, toLatinDigits, weightedTotal, type Recommendation } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { cn, fa, jDate } from '../../lib/format';
import type { Dossier } from '../../lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '../../components/ui';
import { ConfirmDialog } from '../../components/dialog';

export function EvaluationForm({ d }: { d: Dossier }) {
  const qc = useQueryClient();
  const mine = d.mine!;
  const locked = !!mine.evaluation?.submittedAt;
  const reviewable = ['committee_review', 'interview'].includes(d.application.status);
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(mine.scores.map((s) => [s.criterionId, String(Number(s.score))])));
  const [comment, setComment] = useState(mine.evaluation?.comment ?? '');
  const [rec, setRec] = useState<Recommendation | ''>((mine.evaluation?.recommendation as Recommendation) ?? '');
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [ok, setOk] = useState('');

  const parsed = d.criteria.map((c) => ({ c, raw: scores[c.id] ?? '', n: Number(toLatinDigits(scores[c.id] ?? '')) }));
  const invalid = parsed.filter((x) => x.raw !== '' && (isNaN(x.n) || x.n < 0 || x.n > x.c.maxScore));
  const filled = parsed.filter((x) => x.raw !== '' && !invalid.includes(x));
  const total = weightedTotal(filled.map((x) => ({ score: x.n, maxScore: x.c.maxScore, weight: Number(x.c.weight) })));

  const save = useMutation({
    mutationFn: (submit: boolean) => api(`/committee/assignments/${mine.assignment.id}/evaluation`, { method: 'PUT', body: {
      scores: filled.map((x) => ({ criterionId: x.c.id, score: x.n })), comment: comment || null, recommendation: rec || null, submit } }),
    onSuccess: (_, submit) => { setErr(''); setConfirm(false); setOk(submit ? 'ارزیابی نهایی ارسال شد' : 'پیش‌نویس ذخیره شد'); qc.invalidateQueries({ queryKey: ['dossier', d.application.id] }); qc.invalidateQueries({ queryKey: ['assignments'] }); },
    onError: (e) => { setConfirm(false); setOk(''); setErr(e instanceof ApiError ? e.message : 'خطا در ذخیره'); },
  });
  const disabled = locked || !reviewable;
  const canSubmit = !disabled && filled.length === d.criteria.length && !invalid.length && !!rec;

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">فرم امتیازدهی {locked && <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground"><Lock className="h-3.5 w-3.5" />ارسال‌شده {jDate(mine.evaluation!.submittedAt, true)}</span>}</CardTitle>
        {mine.assignment.dueAt && !locked && <p className="text-xs text-muted-foreground">مهلت ارزیابی: {jDate(mine.assignment.dueAt)}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {!reviewable && !locked && <Alert>این پرونده در حال حاضر در مرحلهٔ امتیازدهی نیست.</Alert>}
        {!d.criteria.length && <Alert tone="error">برای این فراخوان معیار امتیازدهی تعریف نشده است.</Alert>}
        <div className="space-y-2">
          {parsed.map(({ c, raw }) => {
            const bad = invalid.some((x) => x.c.id === c.id);
            return (
              <div key={c.id} className="flex items-center gap-3">
                <label htmlFor={`s-${c.id}`} className="flex-1 text-sm">{c.title}<span className="block text-xs text-muted-foreground">حداکثر {fa(c.maxScore)} · وزن {fa(Number(c.weight))}</span></label>
                <Input id={`s-${c.id}`} inputMode="decimal" dir="ltr" className={cn('w-20 text-center', bad && 'border-destructive')} disabled={disabled} value={raw} aria-invalid={bad}
                  onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))} />
              </div>
            );
          })}
        </div>
        {invalid.length > 0 && <p className="text-xs text-destructive">امتیاز باید بین صفر و سقف هر معیار باشد.</p>}
        <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2"><span className="text-sm">امتیاز وزنی (از ۱۰۰)</span><span className="text-xl font-bold text-primary">{fa(total)}</span></div>
        <div>
          <div className="mb-2 text-sm font-medium">پیشنهاد نهایی</div>
          <div className="grid grid-cols-2 gap-2">
            {RECOMMENDATIONS.map((r) => <button key={r} type="button" disabled={disabled} onClick={() => setRec(r)} className={cn('rounded-md border px-2 py-2 text-sm', rec === r ? 'border-primary bg-primary/10 font-medium text-primary' : 'hover:bg-muted', disabled && 'opacity-70')}>{RECOMMENDATION_LABELS_FA[r]}</button>)}
          </div>
        </div>
        <Textarea rows={4} placeholder="نظر و توضیحات شما دربارهٔ متقاضی" disabled={disabled} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} />
        {err && <Alert tone="error">{err}</Alert>}
        {ok && !err && <Alert tone="success">{ok}</Alert>}
        {!disabled && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" loading={save.isPending && !save.variables} onClick={() => save.mutate(false)} disabled={!!invalid.length}><Save className="h-4 w-4" />ذخیره پیش‌نویس</Button>
            <Button className="flex-1" disabled={!canSubmit} onClick={() => setConfirm(true)}><Send className="h-4 w-4" />ارسال نهایی</Button>
          </div>
        )}
      </CardContent>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="ارسال نهایی ارزیابی" description="پس از ارسال، امکان ویرایش امتیازها و نظر وجود ندارد. ادامه می‌دهید؟" confirmText="ارسال" loading={save.isPending} onConfirm={() => save.mutate(true)} />
    </Card>
  );
}
