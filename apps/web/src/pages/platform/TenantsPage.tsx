import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import { Button, Card, CardContent, Skeleton } from '../../components/ui';
import { PageTitle } from '../applicant/ApplicantLayout';
import { isExpired, PLAN_LABELS, type TenantRow } from './types';
import TenantDialog from './TenantDialog';
import TenantAdminDialog from './TenantAdminDialog';

function Usage({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="min-w-24">
      <div className="text-xs">{fa(used)} / {fa(max)}</div>
      <div className="mt-1 h-1.5 rounded bg-muted"><div className={`h-1.5 rounded ${pct >= 90 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function TenantsPage() {
  const q = useQuery({ queryKey: ['platform-tenants'], queryFn: () => api<TenantRow[]>('/platform/tenants') });
  const [edit, setEdit] = useState<TenantRow | null | 'new'>(null);
  const [adminFor, setAdminFor] = useState<TenantRow | null>(null);
  return (
    <>
      <PageTitle title="دانشگاه‌ها و اشتراک" sub="افزودن دانشگاه جدید، دامنه، پلن و سقف‌های مصرف." action={<Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />دانشگاه جدید</Button>} />
      <Card><CardContent className="overflow-x-auto pt-5">
        {q.isLoading ? <Skeleton className="h-48" /> : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-xs text-muted-foreground"><tr>
              <th className="py-2 text-right font-medium">دانشگاه</th><th className="text-right font-medium">دامنه</th><th className="text-right font-medium">پلن</th>
              <th className="text-right font-medium">متقاضی</th><th className="text-right font-medium">فراخوان</th><th className="text-right font-medium">پایان اشتراک</th><th className="text-right font-medium">وضعیت</th><th />
            </tr></thead>
            <tbody>
              {!q.data?.length && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">هنوز دانشگاهی ثبت نشده است</td></tr>}
              {q.data?.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-3"><div className="font-medium">{t.name}</div><div dir="ltr" className="text-right text-xs text-muted-foreground">{t.slug}</div></td>
                  <td dir="ltr" className="text-right text-xs">{t.hostname ?? '—'}</td>
                  <td>{PLAN_LABELS[t.plan]}</td>
                  <td><Usage used={t.applicants} max={t.maxApplicants} /></td>
                  <td><Usage used={t.calls} max={t.maxCalls} /></td>
                  <td className={isExpired(t.subscriptionEndsAt) ? 'text-destructive' : ''}>{t.subscriptionEndsAt ? jDate(t.subscriptionEndsAt) : 'نامحدود'}</td>
                  <td><span className={`rounded px-2 py-0.5 text-xs ${t.status === 'active' && !isExpired(t.subscriptionEndsAt) ? 'bg-secondary text-secondary-foreground' : 'bg-destructive/10 text-destructive'}`}>{t.status !== 'active' ? 'تعلیق' : isExpired(t.subscriptionEndsAt) ? 'منقضی' : 'فعال'}</span></td>
                  <td className="whitespace-nowrap text-left">
                    <Button variant="ghost" size="sm" onClick={() => setAdminFor(t)} title="افزودن مدیر"><UserPlus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setEdit(t)} title="ویرایش"><Pencil className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>
      {edit && <TenantDialog tenant={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {adminFor && <TenantAdminDialog tenant={adminFor} onClose={() => setAdminFor(null)} />}
    </>
  );
}
