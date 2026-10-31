import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '../../components/ui';
import { PageTitle } from '../applicant/ApplicantLayout';
import { PLAN_LABELS, type PerfRow } from './types';

export default function PerformancePage() {
  const q = useQuery({ queryKey: ['platform-perf'], queryFn: () => api<PerfRow[]>('/platform/reports/performance') });
  if (q.isLoading) return <Skeleton className="h-96" />;
  const rows = q.data ?? [];
  return (
    <>
      <PageTitle title="گزارش عملکرد دانشگاه‌ها" />
      <Card className="mb-5"><CardHeader><CardTitle>پرونده‌ها به تفکیک دانشگاه</CardTitle></CardHeader><CardContent className="h-72">
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v) => fa(v)} tick={{ fontSize: 11 }} orientation="right" />
            <Tooltip formatter={(v) => fa(Number(v))} /><Legend />
            <Bar dataKey="submitted" name="ارسال‌شده" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="accepted" name="پذیرفته" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent></Card>
      <Card><CardContent className="overflow-x-auto pt-5">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-xs text-muted-foreground"><tr>
            {['دانشگاه', 'پلن', 'متقاضی', 'ارسال‌شده', 'پذیرفته', 'فراخوان فعال', 'ارزیابی', 'پیامک ۳۰ روز', 'ناموفق', 'آخرین فعالیت'].map((h) => <th key={h} className="py-2 text-right font-medium">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2.5 font-medium">{r.name}</td><td>{PLAN_LABELS[r.plan]}</td>
                <td>{fa(r.applicants)} <span className="text-xs text-muted-foreground">/ {fa(r.maxApplicants)}</span></td>
                <td>{fa(r.submitted)}</td><td>{fa(r.accepted)}</td><td>{fa(r.activeCalls)}</td><td>{fa(r.evaluations)}</td>
                <td>{fa(r.sms30d)}</td><td className={r.smsFailed30d ? 'text-destructive' : ''}>{fa(r.smsFailed30d)}</td>
                <td className="text-xs text-muted-foreground">{r.lastActivity ? jDate(r.lastActivity, true) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </>
  );
}
