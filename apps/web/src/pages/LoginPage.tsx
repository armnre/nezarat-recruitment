import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { GraduationCap, ShieldCheck, Smartphone } from 'lucide-react';
import { mobileSchema } from '@nezarat/shared';
import { api, ApiError, setCsrf } from '../lib/api';
import { useTenant } from '../lib/tenant';
import { fa } from '../lib/format';
import { Alert, Button, Card, Field, Input } from '../components/ui';
import type { Me } from '../lib/types';

export default function LoginPage() {
  const [mode, setMode] = useState<'otp' | 'staff'>('otp');
  const tenant = useTenant();
  const tenantName = tenant.data?.name ?? '';

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3 text-lg font-bold"><GraduationCap className="h-8 w-8 text-accent" /> {tenantName || 'سامانه جذب'}</div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-snug">سامانه جذب و گزینش<br />اعضای هیئت علمی</h1>
          <p className="max-w-md text-primary-foreground/80">ثبت‌نام، تکمیل پرونده، ارسال درخواست و پیگیری لحظه‌ای وضعیت؛ همه بدون مراجعهٔ حضوری.</p>
        </div>
        <p className="text-sm text-primary-foreground/60">اطلاعات شما محرمانه نگهداری می‌شود.</p>
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/20" />
      </aside>
      <main className="flex items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 space-y-1 lg:hidden">
            <GraduationCap className="h-9 w-9 text-primary" />
            <h1 className="text-xl font-bold">سامانه جذب و گزینش اساتید</h1>
            {tenantName && <p className="text-sm text-muted-foreground">{tenantName}</p>}
          </div>
          <div className="mb-6 grid grid-cols-2 rounded-md bg-muted p-1 text-sm">
            <button className={`rounded py-2 ${mode === 'otp' ? 'bg-card font-medium shadow-sm' : ''}`} onClick={() => setMode('otp')}>متقاضی</button>
            <button className={`rounded py-2 ${mode === 'staff' ? 'bg-card font-medium shadow-sm' : ''}`} onClick={() => setMode('staff')}>کمیته و مدیران</button>
          </div>
          {tenant.isFetched && !tenant.data && mode === 'otp' && <div className="mb-4"><Alert tone="error">دانشگاهی برای این نشانی ثبت نشده است.</Alert></div>}
          {mode === 'otp' ? <OtpForm /> : <StaffForm />}
        </Card>
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
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); step === 'mobile' ? request() : verify(); }}>
      {error && <Alert tone="error">{error}</Alert>}
      {step === 'mobile' ? (
        <>
          <Field label="شماره موبایل" hint="کد تأیید به این شماره پیامک می‌شود">
            <div className="relative">
              <Smartphone className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
              <Input dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxxx" className="pr-10" value={mobile} onChange={(e) => setMobile(e.target.value)} autoFocus />
            </div>
          </Field>
          <Button className="w-full" size="lg" loading={busy}>دریافت کد تأیید</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">کد ۶ رقمی ارسال‌شده به <span dir="ltr" className="font-medium text-foreground">{fa(mobile)}</span> را وارد کنید.</p>
          <Field label="کد تأیید">
            <Input dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="text-center text-xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </Field>
          <Button className="w-full" size="lg" loading={busy} disabled={code.length < 6}><ShieldCheck className="h-5 w-5" /> ورود</Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-primary hover:underline" onClick={() => { setStep('mobile'); setCode(''); }}>ویرایش شماره</button>
            {left > 0 ? <span className="text-muted-foreground">ارسال مجدد تا {fa(left)} ثانیه</span>
              : <button type="button" className="text-primary hover:underline" onClick={request}>ارسال مجدد کد</button>}
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
      <Field label="ایمیل"><Input dir="ltr" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="رمز عبور"><Input dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={platform} onChange={(e) => setPlatform(e.target.checked)} /> ورود مدیر پلتفرم
      </label>
      <Button className="w-full" size="lg" loading={busy}>ورود</Button>
    </form>
  );
}
