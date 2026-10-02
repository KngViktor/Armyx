'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { AuthCard } from '@/components/portal/usePortal';
import { TextField } from '@/components/ui/Field';
import { Turnstile } from '@/components/ui/Turnstile';
import { Alert } from '@/components/ui/Alert';

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [mfa, setMfa] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/auth/login', { body: { email, password, totp: mfa ? totp : undefined, captchaToken: token || undefined } });
      if (r.verificationRequired) router.push(`/portal/verify?u=${r.userId}&c=${r.verify.join(',')}`);
      else if (r.mfaRequired) setMfa(true);
      else {
        const next = sp.get('next');
        router.push(next && next.startsWith('/portal') ? next : '/portal');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {sp.get('verified') && <Alert tone="success">Your account is verified. Sign in to start your application.</Alert>}
      {sp.get('reset') && <Alert tone="success">Password changed. Sign in with your new password.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {!mfa ? (
        <>
          <TextField label="Email address" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Turnstile onToken={setToken} />
        </>
      ) : (
        <TextField label="Authentication code" hint="Open your authenticator app and enter the 6-digit code." inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} />
      )}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : mfa ? 'Verify and sign in' : 'Sign in'}</button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/portal/forgot-password" className="text-olive-700 underline">Forgot password?</Link>
        <Link href="/portal/register" className="font-semibold text-olive-700 underline">Create an account</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard title="Applicant sign in" subtitle="Continue your application or check your status.">
      <Suspense><LoginInner /></Suspense>
    </AuthCard>
  );
}
