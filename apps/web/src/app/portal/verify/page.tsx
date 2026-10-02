'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Mail, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthCard } from '@/components/portal/usePortal';
import { Alert } from '@/components/ui/Alert';

type Channel = 'email' | 'phone';

function OtpBox({ userId, channel, onDone }: { userId: string; channel: Channel; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const Icon = channel === 'email' ? Mail : Smartphone;

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api('/auth/otp/verify', { body: { userId, channel, code } });
      setDone(true);
      onDone();
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    try {
      await api('/auth/otp/resend', { body: { userId, channel } });
      setCooldown(60);
      setMsg({ tone: 'success', text: 'A new code has been sent.' });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    }
  }
  if (done) return <p className="flex items-center gap-2 rounded-lg bg-green-50 p-4 font-semibold text-success"><CheckCircle2 aria-hidden />{channel === 'email' ? 'Email' : 'Phone'} verified</p>;
  return (
    <form onSubmit={verify} className="rounded-lg border border-olive-100 p-4">
      <p className="flex items-center gap-2 font-semibold text-olive-900"><Icon aria-hidden className="h-5 w-5" />{channel === 'email' ? 'Code sent to your email' : 'Code sent by SMS'}</p>
      <div className="mt-3 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">6-digit {channel} code</span>
          <input className="field-input text-center font-mono text-xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </label>
        <button className="btn-primary" disabled={busy || code.length !== 6}>Verify</button>
      </div>
      {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <button type="button" onClick={resend} disabled={cooldown > 0} className="mt-3 text-sm font-semibold text-olive-700 underline disabled:text-muted disabled:no-underline">
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </form>
  );
}

function VerifyInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const userId = sp.get('u') ?? '';
  const channels = (sp.get('c') ?? 'email,phone').split(',').filter((c): c is Channel => c === 'email' || c === 'phone');
  const [left, setLeft] = useState(channels.length);
  useEffect(() => {
    if (left === 0) setTimeout(() => router.push('/portal/login?verified=1'), 1200);
  }, [left, router]);
  if (!userId) return <Alert tone="error">Missing account reference. Please register or sign in again.</Alert>;
  return (
    <div className="space-y-4">
      {channels.map((c) => <OtpBox key={c} userId={userId} channel={c} onDone={() => setLeft((n) => n - 1)} />)}
      {left === 0 && <Alert tone="success" title="All verified">Redirecting you to sign in…</Alert>}
      <p className="text-xs text-muted">Codes expire after 10 minutes. Check your spam folder if the email does not arrive.</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AuthCard title="Verify your account" subtitle="Enter the 6-digit codes we sent to your email and phone.">
      <Suspense><VerifyInner /></Suspense>
    </AuthCard>
  );
}
