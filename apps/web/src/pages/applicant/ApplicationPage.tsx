import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Download, FileUp, Send, Trash2, Undo2 } from 'lucide-react';
import { STATUS_LABELS_FA } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { fileSize, jDate } from '../../lib/format';
import type { Application, CallDetail, DocRow, HistoryRow, RequiredDoc } from '../../lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '../../components/ui';
import { ConfirmDialog } from '../../components/dialog';
import { StatusBadge } from '../../components/StatusBadge';

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const app = useQuery({ queryKey: ['application', id], queryFn: () => api<Application>(`/applications/${id}`), refetchInterval: 30_000 });
  const call = useQuery({ queryKey: ['call', app.data?.callId], queryFn: () => api<CallDetail>(`/calls/${app.data!.callId}`), enabled: !!app.data });
  const docs = useQuery({ queryKey: ['docs', id], queryFn: () => api<DocRow[]>(`/applications/${id}/documents`) });
  const hist = useQuery({ queryKey: ['history', id], queryFn: () => api<HistoryRow[]>(`/applications/${id}/history`), refetchInterval: 30_000 });
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'submitted' | 'withdrawn' | null>(null);
  const move = useMutation({
    mutationFn: (to: 'submitted' | 'withdrawn') => api(`/applications/${id}/status`, { method: 'POST', body: { to } }),
    onSuccess: () => { setError(''); setConfirm(null); ['application', 'history', 'applications'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e) => { setConfirm(null); setError(e instanceof ApiError ? e.message : 'خطا'); },
  });

  if (app.isLoading) return <Skeleton className="h-96" />;
  if (!app.data) return <Alert tone="error">درخواست یافت نشد</Alert>;
  const a = app.data;
  const editable = a.status === 'draft' || a.status === 'incomplete';
  const canWithdraw = !['scored', 'accepted', 'rejected', 'reserve', 'withdrawn'].includes(a.status);

  return (
    <>
      <Link to="/applicant" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="h-4 w-4" />بازگشت به پیشخوان</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{call.data?.title ?? '…'}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><StatusBadge status={a.status} />{a.submittedAt && <span>ارسال‌شده در {jDate(a.submittedAt, true)}</span>}</div>
        </div>
        <div className="flex gap-2">
          {canWithdraw && <Button variant="outline" onClick={() => setConfirm('withdrawn')}><Undo2 className="h-4 w-4" />انصراف</Button>}
          {editable && <Button onClick={() => setConfirm('submitted')}><Send className="h-4 w-4" />ارسال نهایی</Button>}
        </div>
      </div>
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {a.status === 'incomplete' && a.decisionNote && <div className="mb-4"><Alert>توضیح کارشناس: {a.decisionNote}</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>مدارک</CardTitle>{editable && <p className="text-xs text-muted-foreground">فرمت مجاز: PDF، JPG، PNG</p>}</CardHeader>
          <CardContent className="space-y-3">
            {(call.data?.requiredDocuments ?? []).map((rd) => (
              <DocSlot key={rd.id} rd={rd} applicationId={a.id} doc={docs.data?.find((d) => d.requiredDocumentId === rd.id)} editable={editable} />
            ))}
            {call.data && !call.data.requiredDocuments.length && <p className="text-sm text-muted-foreground">این فراخوان مدرک الزامی ندارد.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>روند بررسی</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative space-y-5 border-r pr-5">
              {(hist.data ?? []).map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -right-[27px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
                  <p className="font-medium">{STATUS_LABELS_FA[h.toStatus]}</p>
                  <p className="text-xs text-muted-foreground">{jDate(h.createdAt, true)}</p>
                  {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} loading={move.isPending}
        title={confirm === 'submitted' ? 'ارسال نهایی درخواست' : 'انصراف از درخواست'}
        description={confirm === 'submitted' ? 'پس از ارسال، امکان ویرایش مدارک تا اعلام نقص وجود ندارد. ارسال شود؟' : 'با انصراف، درخواست شما از روند بررسی خارج می‌شود و قابل بازگشت نیست.'}
        confirmText={confirm === 'submitted' ? 'ارسال' : 'انصراف از درخواست'} onConfirm={() => confirm && move.mutate(confirm)} />
    </>
  );
}

function DocSlot({ rd, applicationId, doc, editable }: { rd: RequiredDoc; applicationId: string; doc?: DocRow; editable: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['docs', applicationId] });
  const upload = useMutation({
    mutationFn: (f: File) => {
      if (f.size > rd.maxSizeMb * 1048576) throw new ApiError(400, 'SIZE', `حجم فایل نباید بیش از ${rd.maxSizeMb} مگابایت باشد`);
      const fd = new FormData();
      fd.append('applicationId', applicationId);
      fd.append('requiredDocumentId', rd.id);
      fd.append('file', f);
      return api('/documents', { method: 'POST', form: fd });
    },
    onSuccess: () => { setError(''); refresh(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'خطا در بارگذاری'),
  });
  const remove = useMutation({ mutationFn: () => api(`/documents/${doc!.id}`, { method: 'DELETE' }), onSuccess: refresh });

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${doc ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{doc ? <Check className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{rd.title}{rd.required && <span className="text-destructive"> *</span>}</p>
          <p className="truncate text-xs text-muted-foreground">{doc ? `${doc.originalName} · ${fileSize(doc.size)}` : 'بارگذاری نشده'}</p>
        </div>
        {doc && <a href={`/api/v1/documents/${doc.id}`} target="_blank" rel="noreferrer" className="rounded-md p-2 hover:bg-muted" aria-label="مشاهده"><Download className="h-4 w-4" /></a>}
        {editable && doc && <Button variant="ghost" size="icon" aria-label="حذف" loading={remove.isPending} onClick={() => remove.mutate()}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
        {editable && <Button variant="outline" size="sm" loading={upload.isPending} onClick={() => input.current?.click()}>{doc ? 'جایگزینی' : 'انتخاب فایل'}</Button>}
        <input ref={input} type="file" hidden accept={rd.mimeTypes.join(',')} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
