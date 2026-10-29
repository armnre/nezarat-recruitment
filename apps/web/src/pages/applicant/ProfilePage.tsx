import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Check } from 'lucide-react';
import { familyStepSchema, identityStepSchema } from '@nezarat/shared';
import { api, ApiError } from '../../lib/api';
import { cn, fa } from '../../lib/format';
import type { Profile, ProfileResponse } from '../../lib/types';
import { Alert, Button, Card, CardContent, Field, Input, Select, Skeleton, Textarea } from '../../components/ui';
import { JalaliDateInput } from '../../components/JalaliDateInput';
import { PageTitle } from './ApplicantLayout';
import { ResumeSectionEditor } from './ResumeSectionEditor';

const STEPS = ['اطلاعات هویتی', 'سوابق تحصیلی', 'اطلاعات خانوادگی'];

export default function ProfilePage() {
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: () => api<ProfileResponse>('/profile') });
  const [step, setStep] = useState<number | null>(null);
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const done = data.profile.stepCompleted;
  const current = step ?? Math.min(done, 2);

  return (
    <>
      <PageTitle title="تکمیل پرونده" sub="اطلاعات را مرحله‌به‌مرحله وارد کنید؛ هر مرحله جداگانه ذخیره می‌شود." />
      <ol className="mb-6 grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button disabled={i > done} onClick={() => setStep(i)}
              className={cn('flex w-full items-center gap-2 rounded-md border p-3 text-right text-sm disabled:opacity-50', current === i ? 'border-primary bg-secondary' : 'bg-card')}>
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', done > i ? 'bg-success text-primary-foreground' : current === i ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {done > i ? <Check className="h-4 w-4" /> : fa(i + 1)}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
          </li>
        ))}
      </ol>
      <Card><CardContent className="pt-6">
        {current === 0 && <IdentityStep profile={data.profile} onDone={() => setStep(1)} />}
        {current === 1 && <EducationStep data={data} onDone={() => setStep(2)} />}
        {current === 2 && <FamilyStep profile={data.profile} />}
      </CardContent></Card>
    </>
  );
}

function useSave<T>(path: string, onDone: () => void) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: (body: T) => api(path, { method: path.endsWith('done') ? 'POST' : 'PUT', body }),
    onSuccess: async () => { setError(''); await qc.invalidateQueries({ queryKey: ['profile'] }); qc.invalidateQueries({ queryKey: ['me'] }); onDone(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'خطا در ذخیره'),
  });
  return { ...m, error };
}

type IdentityIn = z.input<typeof identityStepSchema>;
function IdentityStep({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const form = useForm<IdentityIn>({
    resolver: zodResolver(identityStepSchema),
    defaultValues: {
      firstName: profile.firstName ?? '', lastName: profile.lastName ?? '', fatherName: profile.fatherName ?? '', nationalCode: profile.nationalCode ?? '',
      birthDate: profile.birthDate ?? '', gender: profile.gender ?? undefined, email: profile.email ?? '', province: profile.province ?? '', city: profile.city ?? '', address: profile.address ?? '',
    },
  });
  const save = useSave<IdentityIn>('/profile/identity', onDone);
  const e = form.formState.errors;
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(() => save.mutate(form.getValues()))}>
      {save.error && <div className="sm:col-span-2"><Alert tone="error">{save.error}</Alert></div>}
      <Field label="نام *" error={e.firstName?.message}><Input {...form.register('firstName')} aria-invalid={!!e.firstName} /></Field>
      <Field label="نام خانوادگی *" error={e.lastName?.message}><Input {...form.register('lastName')} aria-invalid={!!e.lastName} /></Field>
      <Field label="نام پدر *" error={e.fatherName?.message}><Input {...form.register('fatherName')} aria-invalid={!!e.fatherName} /></Field>
      <Field label="کد ملی *" error={e.nationalCode?.message}><Input dir="ltr" inputMode="numeric" maxLength={10} {...form.register('nationalCode')} aria-invalid={!!e.nationalCode} /></Field>
      <Field label="تاریخ تولد *" error={e.birthDate?.message}>
        <Controller control={form.control} name="birthDate" render={({ field }) => <JalaliDateInput value={field.value || null} onChange={(v) => field.onChange(v ?? '')} maxYear={1390} invalid={!!e.birthDate} />} />
      </Field>
      <Field label="جنسیت *" error={e.gender?.message}>
        <Select {...form.register('gender')} aria-invalid={!!e.gender}><option value="">انتخاب کنید</option><option value="male">مرد</option><option value="female">زن</option></Select>
      </Field>
      <Field label="ایمیل" error={e.email?.message} hint="برای دریافت اطلاع‌رسانی‌ها"><Input dir="ltr" type="email" {...form.register('email')} /></Field>
      <Field label="استان *" error={e.province?.message}><Input {...form.register('province')} aria-invalid={!!e.province} /></Field>
      <Field label="شهر *" error={e.city?.message}><Input {...form.register('city')} aria-invalid={!!e.city} /></Field>
      <div className="sm:col-span-2"><Field label="نشانی *" error={e.address?.message}><Textarea {...form.register('address')} aria-invalid={!!e.address} /></Field></div>
      <div className="flex justify-end sm:col-span-2"><Button loading={save.isPending}>ذخیره و مرحلهٔ بعد</Button></div>
    </form>
  );
}

function EducationStep({ data, onDone }: { data: ProfileResponse; onDone: () => void }) {
  const save = useSave<undefined>('/profile/education-done', onDone);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">حداقل مدرک کارشناسی تا آخرین مدرک تحصیلی خود را ثبت کنید.</p>
      <ResumeSectionEditor section="education" items={data.resume.education} />
      {save.error && <Alert tone="error">{save.error}</Alert>}
      <div className="flex justify-end"><Button loading={save.isPending} onClick={() => save.mutate(undefined)}>تأیید و مرحلهٔ بعد</Button></div>
    </div>
  );
}

type FamilyIn = z.input<typeof familyStepSchema>;
function FamilyStep({ profile }: { profile: Profile }) {
  const nav = useNavigate();
  const form = useForm<FamilyIn>({
    resolver: zodResolver(familyStepSchema),
    defaultValues: { maritalStatus: profile.maritalStatus ?? undefined, spouseName: profile.family?.spouseName ?? '', childrenCount: profile.family?.childrenCount ?? 0 },
  });
  const save = useSave<FamilyIn>('/profile/family', () => nav('/applicant'));
  const e = form.formState.errors;
  const married = form.watch('maritalStatus') === 'married';
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(() => save.mutate(form.getValues()))}>
      {save.error && <div className="sm:col-span-2"><Alert tone="error">{save.error}</Alert></div>}
      <Field label="وضعیت تأهل *" error={e.maritalStatus?.message}>
        <Select {...form.register('maritalStatus')} aria-invalid={!!e.maritalStatus}>
          <option value="">انتخاب کنید</option><option value="single">مجرد</option><option value="married">متأهل</option><option value="other">سایر</option>
        </Select>
      </Field>
      <Field label="تعداد فرزندان" error={e.childrenCount?.message}><Input dir="ltr" type="number" min={0} {...form.register('childrenCount')} /></Field>
      {married && <Field label="نام همسر"><Input {...form.register('spouseName')} /></Field>}
      <div className="flex justify-end sm:col-span-2"><Button loading={save.isPending}>ذخیره و پایان</Button></div>
    </form>
  );
}
