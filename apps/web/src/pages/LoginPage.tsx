import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FileCheck2, GraduationCap, KeyRound, ListChecks, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react';
import { mobileSchema } from '@nezarat/shared';
import { api, ApiError, setCsrf } from '../lib/api';
import { useTenant } from '../lib/tenant';
import { fa } from '../lib/format';
import { Alert, Button, Field, Input, Segmented, Skeleton } from '../components/ui';
import type { Me } from '../lib/types';

const FEATURES: [LucideIcon, string, string][] = [
  [FileCheck2, 'پروندهٔ الکترونیک', 'تکمیل مدارک و رزومهٔ علمی در یک‌جا، بدون مراجعهٔ حضوری'],
  [ListChecks, 'ارزیابی شفاف', 'بررسی ساختاریافته توسط کمیته بر اساس معیارهای مصوب'],
  [ShieldCheck, 'محرمانه و امن', 'اطلاعات شما رمزنگاری و فقط در دسترس افراد مجاز است'],
];

function Hero({ name }: { name: string }) {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden
        style={{ backgroundImage: 'linear-gradient(hsl(var(--sidebar-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--sidebar-foreground)) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" aria-hidden />
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-accent text-accent-foreground"><GraduationCap className="h-6 w-6" aria-hidden /></span>
        <span className="text-lg font-bold">{name || 'سامانه جذب'}</span>
      </div>
      <div className="relative max-w-lg space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-medium text-accent">سامانهٔ جذب و گزینش</p>
          <h1 className="text-4xl font-bold leading-[1.35]">جذب اعضای هیئت علمی،<br />دقیق، شفاف و یکپارچه</h1>
        </div>
        <ul className="space-y-5">
          {FEATURES.map(([Icon, t, d]) => (
            <li key={t} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sidebar-active"><Icon className="h-5 w-5 text-accent" aria-hidden /></span>
              <div><p className="font-medium">{t}</p><p className="mt-0.5 text-sm text-sidebar-muted">{d}</p></div>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-xs text-sidebar-muted">ورود شما به منزلهٔ پذیرش قوانین و ضوابط جذب دانشگاه است.</p>
    </aside>
  );
}

export default function LoginPage() {
  const tenant = useTenant();
  const otpEnabled = tenant.data?.otpEnabled !== false;
  const [mode, setMode] = useState<'otp' | 'staff'>('otp');
  const effective = otpEnabled ? mode : 'staff';
  const tenantName = tenant.data?.name ?? '';

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Hero name={tenantName} />
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem] animate-fade-up">
          <div className="mb-8 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground"><GraduationCap className="h-6 w-6" aria-hidden /></span>
            <p className="mt-4 text-sm text-muted-foreground">{tenantName || 'سامانه جذب و گزینش'}</p>
          </div>
          <h2 className="text-2xl font-bold">ورود به سامانه</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{effective === 'otp' ? 'متقاضیان با شمارهٔ موبایل وارد می‌شوند.' : 'اعضای کمیته و مدیران با ایمیل سازمانی وارد شوند.'}</p>

          {tenant.isLoading ? <Skeleton className="mt-6 h-10" /> : otpEnabled && (
            <Segmented label="نوع ورود" className="mt-6 grid w-full grid-cols-2" value={mode} onChange={setMode}
              options={[['otp', <><Smartphone className="h-4 w-4" aria-hidden />متقاضی</>], ['staff', <><KeyRound className="h-4 w-4" aria-hidden />کمیته و مدیران</>]]} />
          )}
          <div className="mt-6 space-y-4">
            {tenant.isFetched && !tenant.data && <Alert tone="error">دانشگاهی برای این نشانی ثبت نشده است.</Alert>}
            {tenant.data && !otpEnabled && <Alert>ورود پیامکی متقاضیان در حال حاضر غیرفعال است. در صورت نیاز با دبیرخانهٔ جذب دانشگاه تماس بگیرید.</Alert>}
            {effective === 'otp' ? <OtpForm /> : <StaffForm />}
          </div>
        </div>
      </main>
    </div>
  );
}

function useFinish() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return (r: { user: Me; csrfToken: string }) => {
    setCsrf(r.csrfToken);
    qc.setQueryData(['me'], r.user);
    nav('/', { replace: true });
  };
}

function OtpForm() {
  const { data: tenantInfo } = useTenant();
  const tenantSlug = () => tenantInfo?.slug ?? '';
  const finish = useFinish();
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [left, setLeft] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const request = async () => {
    setError('');
    const m = mobileSchema.safeParse(mobile);
    if (!m.success) return setError(m.error.issues[0].message);
    setBusy(true);
    try {
      const r = await api<{ expiresIn: number }>('/auth/otp/request', { method: 'POST', body: { tenantSlug: tenantSlug(), mobile } });
      setStep('code');
      setLeft(r.expiresIn);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'خطا');
    } finally { setBusy(false); }
  };
  const verify = async () => {
    setError('');
    setBusy(true);
    try {
      finish(await api('/auth/otp/verify', { method: 'POST', body: { tenantSlug: tenantSlug(), mobile, code } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'خطا');
    } finally { setBusy(false); }
  };

  return (
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); step === 'mobile' ? request() : verify(); }}>
      {step === 'mobile' ? (
        <>
          <Field label="شماره موبایل" error={error || undefined} hint="کد تأیید به این شماره پیامک می‌شود">
            <Input dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxxx" className="h-12 text-base" value={mobile} onChange={(e) => setMobile(e.target.value)} autoFocus />
          </Field>
          <Button className="w-full" size="lg" loading={busy}>دریافت کد تأیید</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">کد ۶ رقمی ارسال‌شده به <span dir="ltr" className="font-medium text-foreground">{fa(mobile)}</span> را وارد کنید.</p>
          <Field label="کد تأیید" error={error || undefined}>
            <Input dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="h-12 text-center text-xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </Field>
          <Button className="w-full" size="lg" loading={busy} disabled={code.length < 6}><ShieldCheck className="h-5 w-5" aria-hidden /> ورود</Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="rounded text-primary hover:underline" onClick={() => { setStep('mobile'); setCode(''); setError(''); }}>ویرایش شماره</button>
            {left > 0 ? <span className="text-muted-foreground tabular" aria-live="polite">ارسال مجدد تا {fa(left)} ثانیه</span>
              : <button type="button" className="rounded text-primary hover:underline" onClick={request}>ارسال مجدد کد</button>}
          </div>
        </>
      )}
    </form>
  );
}

function StaffForm() {
  const { data: tenantInfo } = useTenant();
  const tenantSlug = () => tenantInfo?.slug ?? '';
  const finish = useFinish();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [platform, setPlatform] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      finish(await api('/auth/login', { method: 'POST', body: { email, password, tenantSlug: platform ? undefined : tenantSlug() } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'خطا');
    } finally { setBusy(false); }
  };
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="ایمیل"><Input dir="ltr" type="email" autoComplete="username" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="رمز عبور"><Input dir="ltr" type="password" autoComplete="current-password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={platform} onChange={(e) => setPlatform(e.target.checked)} /> ورود مدیر پلتفرم
      </label>
      <Button className="w-full" size="lg" loading={busy}>ورود</Button>
    </form>
  );
}
