import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FileCheck2, ListChecks } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import type { ApplicationRow, CallDetail } from '../../lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, LinkButton, Skeleton } from '../../components/ui';
import { PageTitle } from './ApplicantLayout';

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const call = useQuery({ queryKey: ['call', id], queryFn: () => api<CallDetail>(`/calls/${id}`) });
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<ApplicationRow[]>('/applications') });
  const mine = apps.data?.find((a) => a.callId === id);
  const apply = useMutation({
    mutationFn: () => api<{ id: string }>('/applications', { method: 'POST', body: { callId: id } }),
    onSuccess: (a) => { qc.invalidateQueries({ queryKey: ['applications'] }); nav(`/applicant/applications/${a.id}`); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'خطا'),
  });

  if (call.isLoading) return <Skeleton className="h-96" />;
  if (call.error || !call.data) return <Alert tone="error">{(call.error as Error)?.message ?? 'فراخوان یافت نشد'}</Alert>;
  const c = call.data;

  return (
    <>
      <PageTitle title={c.title} sub={[c.facultyName, c.departmentName].filter(Boolean).join(' — ') || undefined}
        action={mine ? <LinkButton to={`/applicant/applications/${mine.id}`}>مشاهدهٔ درخواست من</LinkButton>
          : <Button size="lg" loading={apply.isPending} onClick={() => apply.mutate()}>ثبت درخواست</Button>} />
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>شرح فراخوان</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-line leading-8 text-muted-foreground">{c.description || '—'}</p></CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-2 pt-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">شروع</span><span>{jDate(c.opensAt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">مهلت</span><span className="font-medium">{jDate(c.closesAt, true)}</span></div>
              {c.capacity && <div className="flex justify-between"><span className="text-muted-foreground">ظرفیت</span><span>{fa(c.capacity)} نفر</span></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" />مدارک لازم</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {c.requiredDocuments.map((d) => <li key={d.id} className="flex justify-between gap-2"><span>{d.title}</span>{d.required ? <span className="text-xs text-destructive">الزامی</span> : <span className="text-xs text-muted-foreground">اختیاری</span>}</li>)}
                {!c.requiredDocuments.length && <li className="text-muted-foreground">—</li>}
              </ul>
            </CardContent>
          </Card>
          {!!c.criteria.length && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" />معیارهای ارزیابی</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">{c.criteria.map((k) => <li key={k.id} className="flex justify-between"><span>{k.title}</span><span className="text-muted-foreground">{fa(k.maxScore)} امتیاز</span></li>)}</ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
