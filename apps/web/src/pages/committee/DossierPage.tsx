import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { jDate } from '../../lib/format';
import type { Dossier } from '../../lib/types';
import { Alert, Skeleton } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { DossierView } from './DossierView';
import { EvaluationForm } from './EvaluationForm';
import { SummaryPanel } from './SummaryPanel';
import { StatusActions } from './StatusActions';
import { useMe } from '../../lib/auth';

export default function DossierPage() {
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMe();
  const isAdmin = !!me?.roles.includes('university_admin');
  const { data: d, isLoading, error } = useQuery({ queryKey: ['dossier', id], queryFn: () => api<Dossier>(`/committee/applications/${id}`) });
  if (isLoading) return <div className="grid gap-5 lg:grid-cols-[1fr_380px]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  if (!d) return <Alert tone="error">{(error as Error)?.message ?? 'پرونده یافت نشد'}</Alert>;
  return (
    <>
      <Link to={isAdmin ? '/admin/applications' : d.canManage && !d.mine ? '/committee/queue' : '/committee'} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="h-4 w-4" />بازگشت</Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{d.applicant.fullName || 'متقاضی'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><StatusBadge status={d.application.status} /><span>{d.call.title}</span>{d.application.submittedAt && <span>· ارسال {jDate(d.application.submittedAt)}</span>}</div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <DossierView d={d} />
        <div className="space-y-5">
          {d.mine && <EvaluationForm key={d.mine.evaluation?.submittedAt ?? 'draft'} d={d} />}
          {me?.permissions.includes('applications.change_status') && <StatusActions d={d} />}
          {d.canManage && <SummaryPanel d={d} />}
          {!d.mine && !d.canManage && <Alert>این پرونده به شما تخصیص داده نشده است.</Alert>}
        </div>
      </div>
    </>
  );
}
