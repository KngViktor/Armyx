'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { registerSchema } from '@armyx/shared';
import { api, ApiError } from '@/lib/api';
import { AuthCard } from '@/components/portal/usePortal';
import { Checkbox, TextField } from '@/components/ui/Field';
import { Turnstile } from '@/components/ui/Turnstile';
import { Alert } from '@/components/ui/Alert';
import { PasswordStrength } from '@/components/portal/PasswordStrength';

export default function RegisterPage() {
  const router = useRouter();
  const [v, setV] = useState({ surname: '', firstName: '', email: '', phone: '', password: '', confirm: '' });
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const parsed = registerSchema.safeParse({ ...v, consent, captchaToken: token || undefined });
    const f: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) f[String(i.path[0])] ??= i.message;
    if (v.password !== v.confirm) f.confirm = 'Passwords do not match';
    setErrors(f);
    if (!parsed.success || f.confirm) return;
    setBusy(true);
    try {
      const r = await api<{ userId: string }>('/auth/register', { body: parsed.data });
      router.push(`/portal/verify?u=${r.userId}&c=email,phone`);
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError) setErrors(err.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Step 1 of the application. It takes about two minutes.">
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Surname" required autoComplete="family-name" value={v.surname} onChange={set('surname')} error={errors.surname} />
          <TextField label="First name" required autoComplete="given-name" value={v.firstName} onChange={set('firstName')} error={errors.firstName} />
        </div>
        <TextField label="Email address" type="email" required autoComplete="email" value={v.email} onChange={set('email')} error={errors.email} hint="A verification code will be sent here." />
        <TextField label="Mobile number" type="tel" required autoComplete="tel" inputMode="tel" placeholder="080 1234 5678" value={v.phone} onChange={set('phone')} error={errors.phone} hint="Nigerian number. You will receive an SMS code." />
        <div>
          <TextField label="Password" type="password" required autoComplete="new-password" value={v.password} onChange={set('password')} error={errors.password} />
          <PasswordStrength value={v.password} />
        </div>
        <TextField label="Confirm password" type="password" required autoComplete="new-password" value={v.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          error={errors.consent}
          label={<>I consent to the Nigerian Army processing my personal data for recruitment as described in the <Link href="/privacy" target="_blank" className="underline">privacy notice</Link> (NDPA 2023).</>}
        />
        <Turnstile onToken={setToken} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="text-center text-sm text-muted">Already registered? <Link href="/portal/login" className="font-semibold text-olive-700 underline">Sign in</Link></p>
      </form>
    </AuthCard>
  );
}
