import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { Alert, Button, Field, Input } from '../../components/ui';
import { Dialog } from '../../components/dialog';
import type { TenantRow } from './types';

export default function TenantAdminDialog({ tenant, onClose }: { tenant: TenantRow; onClose: () => void }) {
  const [f, setF] = useState({ fullName: '', email: '', password: '' });
  const save = useMutation({ mutationFn: () => api(`/platform/tenants/${tenant.id}/admins`, { method: 'POST', body: f }) });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`مدیر جدید برای ${tenant.name}`}>
      {save.isSuccess ? (
        <div className="space-y-4">
          <Alert tone="success">حساب مدیر ساخته شد. ورود از بخش «کمیته و مدیران» با ایمیل و رمز تعیین‌شده انجام می‌شود.</Alert>
          <div className="flex justify-end"><Button onClick={onClose}>بستن</Button></div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {save.error && <Alert tone="error">{save.error instanceof ApiError ? save.error.message : 'خطا'}</Alert>}
          <Field label="نام و نام خانوادگی"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></Field>
          <Field label="ایمیل"><Input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="رمز عبور اولیه" hint="حداقل ۱۲ کاراکتر"><Input dir="ltr" type="password" autoComplete="new-password" minLength={12} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>انصراف</Button><Button loading={save.isPending}>ساخت حساب</Button></div>
        </form>
      )}
    </Dialog>
  );
}
