import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { OrgFaculty } from '../../lib/types';
import { Alert, Button, Card, CardContent, Input, Skeleton, PageTitle } from '../../components/ui';
import { ConfirmDialog } from '../../components/dialog';

type Kind = 'faculty' | 'department';

function Item({ kind, id, name, onErr }: { kind: Kind; id: string; name: string; onErr: (m: string) => void }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false); const [v, setV] = useState(name); const [del, setDel] = useState(false);
  const done = () => qc.invalidateQueries({ queryKey: ['org'] });
  const err = (e: unknown) => onErr(e instanceof ApiError ? e.message : 'خطا');
  const rename = useMutation({ mutationFn: () => api(`/admin/org/${kind}/${id}`, { method: 'PUT', body: { name: v } }), onSuccess: () => { setEdit(false); done(); }, onError: err });
  const remove = useMutation({ mutationFn: () => api(`/admin/org/${kind}/${id}`, { method: 'DELETE' }), onSuccess: () => { setDel(false); done(); }, onError: (e) => { setDel(false); err(e); } });
  return (
    <div className="flex items-center gap-2">
      {edit ? <><Input className="h-8" value={v} onChange={(e) => setV(e.target.value)} autoFocus /><button onClick={() => rename.mutate()} aria-label="ذخیره" className="rounded p-1.5 hover:bg-muted"><Check className="h-4 w-4" /></button><button onClick={() => { setEdit(false); setV(name); }} aria-label="انصراف" className="rounded p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button></>
        : <><span className={kind === 'faculty' ? 'font-bold' : 'text-sm'}>{name}</span><button onClick={() => setEdit(true)} aria-label="ویرایش" className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => setDel(true)} aria-label="حذف" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></>}
      <ConfirmDialog open={del} onOpenChange={setDel} title="حذف" description={`«${name}» حذف شود؟`} confirmText="حذف" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </div>
  );
}

function AddInline({ facultyId, placeholder, onErr }: { facultyId?: string; placeholder: string; onErr: (m: string) => void }) {
  const qc = useQueryClient(); const [v, setV] = useState('');
  const m = useMutation({ mutationFn: () => api('/admin/org', { method: 'POST', body: { name: v, facultyId } }), onSuccess: () => { setV(''); qc.invalidateQueries({ queryKey: ['org'] }); }, onError: (e) => onErr(e instanceof ApiError ? e.message : 'خطا') });
  return <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) m.mutate(); }}><Input className="h-9" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} /><Button size="sm" variant="outline" loading={m.isPending} type="submit"><Plus className="h-4 w-4" />افزودن</Button></form>;
}

export default function OrgPage() {
  const { data, isLoading } = useQuery({ queryKey: ['org'], queryFn: () => api<OrgFaculty[]>('/org') });
  const [err, setErr] = useState('');
  return (
    <div className="max-w-3xl">
      <PageTitle title="ساختار سازمانی" sub="دانشکده‌ها و گروه‌های آموزشی برای تعریف فراخوان" />
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      <div className="mb-5"><AddInline placeholder="نام دانشکدهٔ جدید" onErr={setErr} /></div>
      {isLoading ? <Skeleton className="h-48" /> : !data?.length ? <Card className="p-10 text-center text-sm text-muted-foreground"><Building2 className="mx-auto mb-2 h-8 w-8" />هنوز دانشکده‌ای ثبت نشده است.</Card> : (
        <div className="space-y-4">
          {data.map((f) => (
            <Card key={f.id}><CardContent className="space-y-3 pt-5">
              <Item kind="faculty" id={f.id} name={f.name} onErr={setErr} />
              <div className="space-y-1 border-r-2 pr-4">{f.departments.map((d) => <Item key={d.id} kind="department" id={d.id} name={d.name} onErr={setErr} />)}</div>
              <AddInline facultyId={f.id} placeholder="نام گروه آموزشی" onErr={setErr} />
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
