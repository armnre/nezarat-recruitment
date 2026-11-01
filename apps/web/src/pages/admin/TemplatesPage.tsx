import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Mail, RotateCcw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Alert, Button, Card, CardContent, Field, Input, PageTitle, Skeleton, Textarea } from '../../components/ui';

type Tpl = { id: string; key: string; channel: 'sms' | 'email'; subject: string | null; body: string; providerTemplate: string | null };
type Resp = { keys: string[]; defaults: Record<string, { subject: string; body: string }>; custom: Tpl[] };

const KEY_LABELS: Record<string, string> = {
  'status.submitted': 'ارسال درخواست', 'status.screening': 'بررسی اولیه', 'status.incomplete': 'نقص مدارک', 'status.committee_review': 'بررسی کمیته',
  'status.interview': 'دعوت به مصاحبه', 'status.scored': 'امتیازدهی شد', 'status.accepted': 'پذیرش', 'status.rejected': 'عدم پذیرش', 'status.reserve': 'رزرو',
  'status.withdrawn': 'انصراف', 'committee.assigned': 'تخصیص پرونده به داور', 'committee.due': 'یادآوری مهلت داوری',
};

function Editor({ k, channel, data }: { k: string; channel: 'sms' | 'email'; data: Resp }) {
  const qc = useQueryClient();
  const custom = data.custom.find((c) => c.key === k && c.channel === channel);
  const def = data.defaults[k];
  const [subject, setSubject] = useState(custom?.subject ?? def.subject);
  const [body, setBody] = useState(custom?.body ?? def.body);
  const [providerTemplate, setPT] = useState(custom?.providerTemplate ?? '');
  const refresh = () => qc.invalidateQueries({ queryKey: ['templates'] });
  const save = useMutation({ mutationFn: () => api('/admin/templates', { method: 'PUT', body: { key: k, channel, subject: channel === 'email' ? subject : null, body, providerTemplate: providerTemplate || null } }), onSuccess: refresh });
  const reset = useMutation({ mutationFn: () => api(`/admin/templates/${custom!.id}`, { method: 'DELETE' }), onSuccess: () => { setSubject(def.subject); setBody(def.body); setPT(''); refresh(); } });
  const err = save.error ?? reset.error;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {err && <Alert tone="error">{err instanceof ApiError ? err.message : 'خطا'}</Alert>}
      {save.isSuccess && !save.isPending && <Alert tone="success">ذخیره شد</Alert>}
      {channel === 'email' && <Field label="موضوع ایمیل"><Input value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>}
      <Field label="متن پیام" hint="متغیرها: {{tenant}} نام دانشگاه، {{statusLabel}} وضعیت پرونده"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
      {channel === 'sms' && <Field label="کد الگوی سرویس پیامک (اختیاری)" hint="برای ارسال با الگوی ثبت‌شده در پنل پیامک"><Input dir="ltr" value={providerTemplate} onChange={(e) => setPT(e.target.value)} /></Field>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{custom ? 'قالب سفارشی' : 'قالب پیش‌فرض سامانه'}</span>
        <div className="flex gap-2">
          {custom && <Button type="button" variant="ghost" size="sm" loading={reset.isPending} onClick={() => reset.mutate()}><RotateCcw className="h-4 w-4" />بازگشت به پیش‌فرض</Button>}
          <Button size="sm" loading={save.isPending}>ذخیره</Button>
        </div>
      </div>
    </form>
  );
}

export default function TemplatesPage() {
  const q = useQuery({ queryKey: ['templates'], queryFn: () => api<Resp>('/admin/templates') });
  const [key, setKey] = useState('status.submitted');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  return (
    <>
      <PageTitle title="قالب پیام‌ها" sub="متن پیامک و ایمیل‌هایی که در هر مرحله برای متقاضیان و داوران ارسال می‌شود." />
      {q.isLoading || !q.data ? <Skeleton className="h-80" /> : (
        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          <Card><CardContent className="space-y-1 p-2">
            {q.data.keys.map((k) => {
              const customized = q.data!.custom.some((c) => c.key === k);
              return (
                <button key={k} onClick={() => setKey(k)} aria-current={key === k ? 'true' : undefined} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-right text-sm ${key === k ? 'bg-secondary font-medium' : 'hover:bg-muted'}`}>
                  {KEY_LABELS[k] ?? k}{customized && <span className="h-2 w-2 rounded-full bg-accent" title="سفارشی" />}
                </button>
              );
            })}
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <div className="mb-4 inline-grid grid-cols-2 rounded-md bg-muted p-1 text-sm">
              <button className={`flex items-center gap-1 rounded px-4 py-1.5 ${channel === 'sms' ? 'bg-card shadow-sm' : ''}`} onClick={() => setChannel('sms')}><MessageSquare className="h-4 w-4" />پیامک</button>
              <button className={`flex items-center gap-1 rounded px-4 py-1.5 ${channel === 'email' ? 'bg-card shadow-sm' : ''}`} onClick={() => setChannel('email')}><Mail className="h-4 w-4" />ایمیل</button>
            </div>
            <Editor key={`${key}-${channel}-${q.dataUpdatedAt}`} k={key} channel={channel} data={q.data} />
          </CardContent></Card>
        </div>
      )}
    </>
  );
}
