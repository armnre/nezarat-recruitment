import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RESUME_LABELS, RESUME_SECTIONS, type ResumeSection } from '@nezarat/shared';
import { api } from '../../lib/api';
import { cn, fa } from '../../lib/format';
import type { ProfileResponse } from '../../lib/types';
import { Card, CardContent, Skeleton } from '../../components/ui';
import { PageTitle } from './ApplicantLayout';
import { ResumeSectionEditor } from './ResumeSectionEditor';

export default function ResumePage() {
  const [tab, setTab] = useState<ResumeSection>('publications');
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: () => api<ProfileResponse>('/profile') });

  return (
    <>
      <PageTitle title="رزومهٔ علمی" sub="سوابق علمی، پژوهشی، آموزشی و اجرایی خود را به‌صورت ساختارمند ثبت کنید. کمیته بر اساس همین اطلاعات امتیازدهی می‌کند." />
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label="بخش‌های رزومه">
          {RESUME_SECTIONS.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={cn('flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm', tab === s ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted border')}>
              {RESUME_LABELS[s]}
              <span className={cn('rounded-full px-2 text-xs', tab === s ? 'bg-primary-foreground/20' : 'bg-muted')}>{fa(data?.resume[s].length ?? 0)}</span>
            </button>
          ))}
        </nav>
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-4 font-bold">{RESUME_LABELS[tab]}</h2>
            {isLoading || !data ? <Skeleton className="h-32" /> : <ResumeSectionEditor key={tab} section={tab} items={data.resume[tab]} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
