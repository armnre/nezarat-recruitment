import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { Dialog } from '../../components/dialog';
import { JalaliDateInput } from '../../components/JalaliDateInput';
import type { TenantRow } from './types';

export default function TenantDialog({ tenant, onClose }: { tenant: TenantRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: tenant?.name ?? '', slug: tenant?.slug ?? '', hostname: tenant?.hostname ?? '', plan: tenant?.plan ?? 'basic', status: tenant?.status ?? 'active',
    maxApplicants: String(tenant?.maxApplicants ?? 500), maxCalls: String(tenant?.maxCalls ?? 10), subscriptionEndsAt: tenant?.subscriptionEndsAt?.slice(0, 10) ?? null as string | null,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => api(tenant ? `/platform/tenants/${tenant.id}` : '/platform/tenants', {
      method: tenant ? 'PUT' : 'POST',
      body: { ...f, hostname: f.hostname.trim() || null, subscriptionEndsAt: f.subscriptionEndsAt ? `${f.subscriptionEndsAt}T23:59:59+03:30` : null },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-tenants'] }); onClose(); },
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={tenant ? 'ویرایش دانشگاه' : 'دانشگاه جدید'}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {save.error && <Alert tone="error">{save.error instanceof ApiError ? save.error.message : 'خطا در ذخیره'}</Alert>}
        <Field label="نام دانشگاه"><Input value={f.name} onChange={set('name')} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="شناسهٔ لاتین" hint="مثل shomal"><Input dir="ltr" value={f.slug} onChange={set('slug')} required /></Field>
          <Field label="دامنه" hint="مثل jazb.shomal.ac.ir"><Input dir="ltr" value={f.hostname} onChange={set('hostname')} /></Field>
          <Field label="پلن"><Select value={f.plan} onChange={set('plan')}><option value="basic">پایه</option><option value="pro">حرفه‌ای</option><option value="enterprise">سازمانی</option></Select></Field>
          <Field label="وضعیت"><Select value={f.status} onChange={set('status')}><option value="active">فعال</option><option value="suspended">تعلیق</option></Select></Field>
          <Field label="سقف متقاضی"><Input type="number" min={1} dir="ltr" value={f.maxApplicants} onChange={set('maxApplicants')} required /></Field>
          <Field label="سقف فراخوان"><Input type="number" min={1} dir="ltr" value={f.maxCalls} onChange={set('maxCalls')} required /></Field>
        </div>
        <Field label="تاریخ پایان اشتراک" hint="خالی = نامحدود">
          <div className="flex items-center gap-2">
            <JalaliDateInput value={f.subscriptionEndsAt} onChange={(v) => setF({ ...f, subscriptionEndsAt: v })} minYear={1400} maxYear={1420} />
            {f.subscriptionEndsAt && <Button type="button" variant="ghost" size="sm" onClick={() => setF({ ...f, subscriptionEndsAt: null })}>پاک کردن</Button>}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>انصراف</Button><Button loading={save.isPending}>ذخیره</Button></div>
      </form>
    </Dialog>
  );
}
