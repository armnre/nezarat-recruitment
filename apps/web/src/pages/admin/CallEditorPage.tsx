import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { ALLOWED_MIMES, callInputSchema, type CallInput } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { cn, fa } from '../../lib/format';
import type { AdminCall, OrgFaculty } from '../../lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Skeleton, Textarea } from '../../components/ui';
import { JalaliDateInput } from '../../components/JalaliDateInput';

const MIME_LABEL: Record<string, string> = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' };
type Doc = CallInput['requiredDocuments'][number];
type Crit = { title: string; category: string; maxScore: string; weight: string };
type Form = { title: string; description: string; departmentId: string; opensAt: string | null; closesAt: string | null; capacity: string; interview: boolean; minReviewers: string; docs: Doc[]; criteria: Crit[] };

const empty: Form = { title: '', description: '', departmentId: '', opensAt: null, closesAt: null, capacity: '', interview: true, minReviewers: '2',
  docs: [{ key: 'cv', title: 'رزومه', mimeTypes: ['application/pdf'], maxSizeMb: 5, required: true }], criteria: [{ title: 'سوابق پژوهشی', category: '', maxScore: '40', weight: '1' }] };

const toForm = (c: AdminCall): Form => ({
  title: c.title, description: c.description, departmentId: c.departmentId ?? '', opensAt: c.opensAt.slice(0, 10), closesAt: c.closesAt.slice(0, 10),
  capacity: c.capacity ? String(c.capacity) : '', interview: c.workflow.interview, minReviewers: String(c.workflow.minReviewers),
  docs: c.requiredDocuments.map((d) => ({ key: d.key, title: d.title, mimeTypes: d.mimeTypes as Doc['mimeTypes'], maxSizeMb: d.maxSizeMb, required: d.required })),
  criteria: c.criteria.map((x) => ({ title: x.title, category: x.category ?? '', maxScore: String(x.maxScore), weight: String(Number(x.weight)) })),
});

export default function CallEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const qc = useQueryClient();
  const call = useQuery({ queryKey: ['admin-call', id], queryFn: () => api<AdminCall>(`/admin/calls/${id}`), enabled: !isNew });
  const org = useQuery({ queryKey: ['org'], queryFn: () => api<OrgFaculty[]>('/org') });
  const [f, setF] = useState<Form>(empty);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => { if (call.data) setF(toForm(call.data)); }, [call.data]);
  const locked = !!call.data?.structureLocked;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: (body: CallInput) => api<AdminCall>(isNew ? '/admin/calls' : `/admin/calls/${id}`, { method: isNew ? 'POST' : 'PUT', body }),
    onSuccess: (c) => { setErr(''); setOk('تغییرات ذخیره شد'); qc.invalidateQueries({ queryKey: ['admin-calls'] }); qc.setQueryData(['admin-call', c.id], c); if (isNew) nav(`/admin/calls/${c.id}`, { replace: true }); },
    onError: (e) => { setOk(''); setErr(e instanceof ApiError ? e.message : 'خطا در ذخیره'); },
  });

  const submit = () => {
    if (!f.opensAt || !f.closesAt) return setErr('تاریخ شروع و پایان را وارد کنید');
    const parsed = callInputSchema.safeParse({
      title: f.title, description: f.description, departmentId: f.departmentId || null,
      opensAt: `${f.opensAt}T00:00:00+03:30`, closesAt: `${f.closesAt}T23:59:59+03:30`, capacity: f.capacity || null,
      workflow: { interview: f.interview, minReviewers: f.minReviewers }, requiredDocuments: f.docs,
      criteria: f.criteria.map((c) => ({ title: c.title, category: c.category || null, maxScore: c.maxScore, weight: c.weight })),
    });
    if (!parsed.success) { setOk(''); return setErr(parsed.error.issues[0]?.message ?? 'اطلاعات نامعتبر است'); }
    save.mutate(parsed.data);
  };

  if (!isNew && call.isLoading) return <Skeleton className="h-96" />;
  if (!isNew && !call.data) return <Alert tone="error">فراخوان یافت نشد</Alert>;
  const updDoc = (i: number, p: Partial<Doc>) => set('docs', f.docs.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const updCrit = (i: number, p: Partial<Crit>) => set('criteria', f.criteria.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const totalWeight = f.criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);

  return (
    <div className="max-w-4xl">
      <Link to="/admin/calls" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="h-4 w-4" />فراخوان‌ها</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{isNew ? 'فراخوان جدید' : 'ویرایش فراخوان'}</h1>
        <Button onClick={submit} loading={save.isPending}><Save className="h-4 w-4" />ذخیره</Button>
      </div>
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      {ok && !err && <div className="mb-4"><Alert tone="success">{ok}</Alert></div>}
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>مشخصات</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Field label="عنوان فراخوان"><Input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
          <div className="md:col-span-2"><Field label="شرح و شرایط"><Textarea rows={5} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field></div>
          <Field label="گروه آموزشی"><Select value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}><option value="">— بدون گروه —</option>{(org.data ?? []).map((fc) => <optgroup key={fc.id} label={fc.name}>{fc.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>)}</Select></Field>
          <Field label="ظرفیت (اختیاری)"><Input inputMode="numeric" dir="ltr" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></Field>
          <Field label="تاریخ شروع"><JalaliDateInput value={f.opensAt} onChange={(v) => set('opensAt', v)} minYear={1403} /></Field>
          <Field label="تاریخ پایان"><JalaliDateInput value={f.closesAt} onChange={(v) => set('closesAt', v)} minYear={1403} /></Field>
          <Field label="حداقل تعداد داور هر پرونده"><Input inputMode="numeric" dir="ltr" value={f.minReviewers} onChange={(e) => set('minReviewers', e.target.value)} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={f.interview} onChange={(e) => set('interview', e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />مرحلهٔ مصاحبه دارد</label>
        </CardContent></Card>

        {locked && <Alert><span className="inline-flex items-center gap-2"><Lock className="h-4 w-4" />این فراخوان درخواست دریافت کرده؛ مدارک و معیارها قفل شده‌اند و فقط مشخصات قابل تغییر است.</span></Alert>}

        <Card className={cn(locked && 'pointer-events-none opacity-60')}>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>مدارک لازم</CardTitle><Button size="sm" variant="outline" onClick={() => set('docs', [...f.docs, { key: `doc_${f.docs.length + 1}`, title: '', mimeTypes: ['application/pdf'], maxSizeMb: 5, required: true }])}><Plus className="h-4 w-4" />افزودن</Button></CardHeader>
          <CardContent className="space-y-3">
            {!f.docs.length && <p className="text-sm text-muted-foreground">مدرکی تعریف نشده است.</p>}
            {f.docs.map((d, i) => (
              <div key={i} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_140px_90px_auto]">
                <Input placeholder="عنوان مدرک" value={d.title} onChange={(e) => updDoc(i, { title: e.target.value })} />
                <Input placeholder="کلید لاتین" dir="ltr" value={d.key} onChange={(e) => updDoc(i, { key: e.target.value })} />
                <Input aria-label="حداکثر حجم (مگابایت)" title="حداکثر حجم (مگابایت)" inputMode="numeric" dir="ltr" value={d.maxSizeMb} onChange={(e) => updDoc(i, { maxSizeMb: Number(e.target.value) || 0 })} />
                <button onClick={() => set('docs', f.docs.filter((_, j) => j !== i))} className="justify-self-end rounded p-2 text-muted-foreground hover:text-destructive" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
                <div className="flex flex-wrap items-center gap-3 text-sm md:col-span-4">
                  {ALLOWED_MIMES.map((m) => <label key={m} className="flex items-center gap-1"><input type="checkbox" checked={d.mimeTypes.includes(m)} onChange={(e) => updDoc(i, { mimeTypes: e.target.checked ? [...d.mimeTypes, m] : d.mimeTypes.filter((x) => x !== m) })} />{MIME_LABEL[m]}</label>)}
                  <label className="mr-auto flex items-center gap-1"><input type="checkbox" checked={d.required} onChange={(e) => updDoc(i, { required: e.target.checked })} />الزامی</label>
                  <span className="text-xs text-muted-foreground">حداکثر {fa(d.maxSizeMb)} مگابایت</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={cn(locked && 'pointer-events-none opacity-60')}>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>معیارهای امتیازدهی</CardTitle><p className="text-xs text-muted-foreground">امتیاز نهایی هر داور = میانگین وزنی (امتیاز ÷ سقف) × ۱۰۰ · مجموع وزن‌ها: {fa(totalWeight)}</p></div><Button size="sm" variant="outline" onClick={() => set('criteria', [...f.criteria, { title: '', category: '', maxScore: '10', weight: '1' }])}><Plus className="h-4 w-4" />افزودن</Button></CardHeader>
          <CardContent className="space-y-2">
            {!f.criteria.length && <p className="text-sm text-muted-foreground">برای انتشار فراخوان حداقل یک معیار لازم است.</p>}
            {f.criteria.length > 0 && <div className="hidden grid-cols-[1fr_140px_90px_80px_auto] gap-3 px-1 text-xs text-muted-foreground md:grid"><span>عنوان</span><span>دسته</span><span>سقف امتیاز</span><span>وزن</span><span /></div>}
            {f.criteria.map((c, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_140px_90px_80px_auto]">
                <Input className="col-span-2 md:col-span-1" placeholder="عنوان معیار" value={c.title} onChange={(e) => updCrit(i, { title: e.target.value })} />
                <Input placeholder="دسته (اختیاری)" value={c.category} onChange={(e) => updCrit(i, { category: e.target.value })} />
                <Input aria-label="سقف امتیاز" inputMode="numeric" dir="ltr" value={c.maxScore} onChange={(e) => updCrit(i, { maxScore: e.target.value })} />
                <Input aria-label="وزن" inputMode="decimal" dir="ltr" value={c.weight} onChange={(e) => updCrit(i, { weight: e.target.value })} />
                <button onClick={() => set('criteria', f.criteria.filter((_, j) => j !== i))} className="justify-self-end rounded p-2 text-muted-foreground hover:text-destructive" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
