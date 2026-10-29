import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { RESUME_LABELS, resumeSchemas, type ResumeSection } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { fa, faMoney, jDate } from '../../lib/format';
import type { ResumeItem } from '../../lib/types';
import { Alert, Button, Field, Input, Select, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/dialog';
import { JalaliDateInput } from '../../components/JalaliDateInput';
import { optionLabel, RESUME_FIELDS } from './resumeFields';

export function ResumeSectionEditor({ section, items }: { section: ResumeSection; items: ResumeItem[] }) {
  const [editing, setEditing] = useState<ResumeItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ResumeItem | null>(null);
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api(`/resume/${section}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setDeleting(null); },
  });
  const fields = RESUME_FIELDS[section];

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">موردی در «{RESUME_LABELS[section]}» ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium">{optionLabel(fields[0], it[fields[0].name])}{fields[0].type === 'select' ? ` — ${it[fields[1].name] ?? ''}` : ''}</p>
                <p className="text-xs text-muted-foreground">
                  {fields.slice(fields[0].type === 'select' ? 2 : 1).filter((f) => it[f.name] != null && it[f.name] !== '' && f.type !== 'textarea').slice(0, 4)
                    .map((f) => f.type === 'date' ? jDate(it[f.name] as string) : f.name === 'budget' ? `${faMoney(it[f.name])} ریال` : fa(optionLabel(f, it[f.name]))).join(' · ')}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="ویرایش" onClick={() => setEditing(it)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => setDeleting(it)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> افزودن</Button>
      {editing && <ItemDialog section={section} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)} title="حذف مورد" description="این مورد از رزومهٔ شما حذف می‌شود. ادامه می‌دهید؟"
        confirmText="حذف" loading={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </div>
  );
}

function ItemDialog({ section, item, onClose }: { section: ResumeSection; item: ResumeItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fields = RESUME_FIELDS[section];
  const [error, setError] = useState('');
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(resumeSchemas[section] as never),
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, item?.[f.name] ?? (f.type === 'date' ? null : '')])),
  });
  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) => item
      ? api(`/resume/${section}/${item.id}`, { method: 'PUT', body: data })
      : api(`/resume/${section}`, { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'خطا در ذخیره'),
  });
  const errs = form.formState.errors;
  // send the raw form values: the server validates with the same schema
  const onSubmit = form.handleSubmit(() => save.mutate(form.getValues()));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`${item ? 'ویرایش' : 'افزودن'} — ${RESUME_LABELS[section]}`}>
      <form className="space-y-4" onSubmit={onSubmit}>
        {error && <Alert tone="error">{error}</Alert>}
        {fields.map((f) => (
          <Field key={f.name} label={f.label + (f.required ? ' *' : '')} error={errs[f.name]?.message as string | undefined}>
            {f.type === 'date' ? (
              <Controller control={form.control} name={f.name} render={({ field }) => <JalaliDateInput value={field.value as string | null} onChange={field.onChange} invalid={!!errs[f.name]} />} />
            ) : f.type === 'select' ? (
              <Select {...form.register(f.name)} aria-invalid={!!errs[f.name]}>
                <option value="">انتخاب کنید</option>
                {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            ) : f.type === 'textarea' ? (
              <Textarea {...form.register(f.name)} aria-invalid={!!errs[f.name]} />
            ) : (
              <Input {...form.register(f.name)} dir={f.ltr || f.type === 'number' ? 'ltr' : undefined} inputMode={f.type === 'number' ? 'decimal' : undefined} aria-invalid={!!errs[f.name]} />
            )}
          </Field>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>انصراف</Button>
          <Button loading={save.isPending}>ذخیره</Button>
        </div>
      </form>
    </Dialog>
  );
}
