import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Circle, Megaphone } from 'lucide-react';
import { api } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import type { ApplicationRow, ProfileResponse } from '../../lib/types';
import { LinkButton, Card, CardContent, CardHeader, CardTitle, Skeleton } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { PageTitle } from './ApplicantLayout';

const STEPS = ['اطلاعات هویتی', 'سوابق تحصیلی', 'اطلاعات خانوادگی'];

export default function DashboardPage() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<ProfileResponse>('/profile') });
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<ApplicationRow[]>('/applications') });
  const step = profile.data?.profile.stepCompleted ?? 0;
  const name = profile.data?.profile.firstName;

  return (
    <>
      <PageTitle title={name ? `${name} عزیز، خوش آمدید` : 'خوش آمدید'} sub="وضعیت پرونده و درخواست‌های خود را از اینجا دنبال کنید." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>تکمیل پرونده</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {profile.isLoading ? <Skeleton className="h-24" /> : (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(Math.min(step, 3) / 3) * 100}%` }} /></div>
                <ul className="space-y-2 text-sm">
                  {STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-2">
                      {step > i ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}{s}
                    </li>
                  ))}
                </ul>
                {step < 3 && <LinkButton to="/applicant/profile">ادامهٔ تکمیل پرونده</LinkButton>}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>درخواست‌های من</CardTitle></CardHeader>
          <CardContent>
            {apps.isLoading ? <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
              : !apps.data?.length ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                  <Megaphone className="h-10 w-10" />
                  <p>هنوز درخواستی ثبت نکرده‌اید.</p>
                  <Link to="/applicant/calls" className="text-sm font-medium text-primary hover:underline">مشاهدهٔ فراخوان‌های فعال</Link>
                </div>
              ) : (
                <ul className="divide-y">
                  {apps.data.map((a) => (
                    <li key={a.id}>
                      <Link to={`/applicant/applications/${a.id}`} className="flex items-center gap-3 py-3 hover:bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{a.callTitle}</p>
                          <p className="text-xs text-muted-foreground">{a.submittedAt ? `ارسال: ${jDate(a.submittedAt)}` : `مهلت: ${jDate(a.callClosesAt)}`}</p>
                        </div>
                        <StatusBadge status={a.status} />
                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            {!!apps.data?.length && <p className="mt-3 text-xs text-muted-foreground">{fa(apps.data.length)} درخواست</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
