import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import type { AdminCallRow, AuditRow } from '../../lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Select, Skeleton } from '../../components/ui';
import { PageTitle } from '../applicant/ApplicantLayout';

const ACTIONS: Record<string, string> = {
  'application.status': 'تغییر وضعیت پرونده', 'evaluation.score': 'ثبت/تغییر امتیاز', 'evaluation.comment': 'ثبت نظر داور', 'evaluation.submit': 'ارسال ارزیابی',
  'evaluation.finalize': 'ثبت امتیاز نهایی', 'committee.assign': 'تخصیص داور', 'committee.unassign': 'حذف تخصیص', 'dossier.view': 'مشاهدهٔ پرونده',
  'call.create': 'ایجاد فراخوان', 'call.update': 'ویرایش فراخوان', 'call.status': 'تغییر وضعیت فراخوان', 'call.delete': 'حذف فراخوان',
  'member.add': 'افزودن عضو کمیته', 'member.update': 'ویرایش عضو کمیته', 'report.export': 'خروجی گزارش', 'document.upload': 'بارگذاری مدرک', 'user.register': 'ثبت‌نام',
};
const ENTITIES: [string, string][] = [['', 'همه'], ['applications', 'پرونده‌ها'], ['evaluation_scores', 'امتیازها'], ['evaluations', 'ارزیابی‌ها'], ['committee_assignments', 'تخصیص‌ها'], ['calls', 'فراخوان‌ها'], ['committee_members', 'اعضا']];

export default function ReportsPage() {
  const calls = useQuery({ queryKey: ['admin-calls'], queryFn: () => api<AdminCallRow[]>('/admin/calls') });
  const [callId, setCallId] = useState(''); const [entity, setEntity] = useState(''); const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const PER = 50;
  const logs = useQuery({ queryKey: ['audit', entity, page], queryFn: () => api<AuditRow[]>(`/admin/audit?limit=${PER}&offset=${page * PER}${entity ? `&entity=${entity}` : ''}`) });
  const download = async () => {
    setBusy(true); setErr('');
    try {
      const blob = await api<Blob>(`/admin/reports/applications.csv${callId ? `?callId=${callId}` : ''}`);
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'applications.csv'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'خطا در دریافت گزارش'); } finally { setBusy(false); }
  };
  return (
    <>
      <PageTitle title="گزارش و رویدادها" />
      <Card className="mb-5"><CardHeader><CardTitle>خروجی پرونده‌ها (Excel / CSV)</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3">
        <Select className="w-64" value={callId} onChange={(e) => setCallId(e.target.value)}><option value="">همهٔ فراخوان‌ها</option>{(calls.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
        <Button onClick={download} loading={busy}><Download className="h-4 w-4" />دریافت فایل</Button>
        {err && <div className="w-full"><Alert tone="error">{err}</Alert></div>}
      </CardContent></Card>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><CardTitle>رویدادنگار (Audit Log)</CardTitle>
          <Select className="w-44" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }}>{ENTITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></CardHeader>
        <CardContent className="overflow-x-auto">
          {logs.isLoading ? <Skeleton className="h-48" /> : (
            <table className="w-full min-w-[680px] text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-2 text-right font-medium">زمان</th><th className="text-right font-medium">کاربر</th><th className="text-right font-medium">رویداد</th><th className="text-right font-medium">جزئیات</th></tr></thead>
              <tbody>
                {!logs.data?.length && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">رویدادی ثبت نشده است</td></tr>}
                {logs.data?.map((l) => (
                  <tr key={l.id} className="border-t align-top">
                    <td className="py-2 text-xs text-muted-foreground">{jDate(l.createdAt, true)}</td>
                    <td className="py-2">{l.actor || fa(l.actorMobile ?? '') || '—'}</td>
                    <td className="py-2">{ACTIONS[l.action] ?? l.action}</td>
                    <td className="max-w-xs py-2"><code dir="ltr" className="block truncate text-[11px] text-muted-foreground" title={JSON.stringify({ before: l.before, after: l.after })}>{l.after ? JSON.stringify(l.after) : '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 flex justify-between text-sm">
            <button disabled={!page} onClick={() => setPage((p) => p - 1)} className="rounded px-3 py-1 hover:bg-muted disabled:opacity-40">جدیدتر</button>
            <button disabled={(logs.data?.length ?? 0) < PER} onClick={() => setPage((p) => p + 1)} className="rounded px-3 py-1 hover:bg-muted disabled:opacity-40">قدیمی‌تر</button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
