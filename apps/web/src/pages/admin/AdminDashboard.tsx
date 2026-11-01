import { Clock, FileText, Megaphone, UserCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { APPLICATION_STATUSES, STATUS_LABELS_FA } from '@nezarat/shared';
import { api } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import type { AdminStats } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle, PageTitle, Skeleton, StatCard } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<AdminStats>('/admin/stats') });
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  const count = (s: string) => data.byStatus.find((b) => b.status === s)?.count ?? 0;
  const total = data.byStatus.filter((b) => b.status !== 'draft').reduce((a, b) => a + b.count, 0);
  const chart = APPLICATION_STATUSES.filter((s) => s !== 'draft').map((s) => ({ name: STATUS_LABELS_FA[s], value: count(s) }));
  const kpis = [['پرونده‌های ارسال‌شده', total, FileText, 'default'], ['در انتظار بررسی اولیه', count('submitted') + count('screening'), Clock, 'warning'], ['در دست کمیته', count('committee_review') + count('interview'), Users, 'accent'], ['فراخوان باز', data.openCalls, Megaphone, 'success'], ['اعضای فعال کمیته', data.activeMembers, UserCheck, 'default']] as const;
  return (
    <>
      <PageTitle title="پیشخوان مدیریت" sub="نمای کلی فرایند جذب در دانشگاه" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map(([l, v, icon, tone]) => <StatCard key={l} label={l} value={v} icon={icon} tone={tone} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>پرونده‌ها بر اساس وضعیت</CardTitle></CardHeader>
          <CardContent className="h-72" dir="ltr">
            <ResponsiveContainer><BarChart data={chart} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" orientation="right" width={95} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fa(Number(v))} /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>آخرین فعالیت پرونده‌ها</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!data.recent.length && <p className="text-sm text-muted-foreground">هنوز پرونده‌ای ارسال نشده است.</p>}
            {data.recent.map((r) => (
              <Link key={r.id} to={`/admin/applications/${r.id}`} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-muted">
                <span className="min-w-0"><span className="block truncate font-medium">{r.applicantName || 'بدون نام'}</span><span className="block truncate text-xs text-muted-foreground">{r.callTitle} · {jDate(r.submittedAt)}</span></span>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
