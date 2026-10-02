'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { AuthCard } from '@/components/portal/usePortal';
import { TextField } from '@/components/ui/Field';
import { Turnstile } from '@/components/ui/Turnstile';
import { Alert } from '@/components/ui/Alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    setError('');
    try {
      await api('/auth/password/forgot', { body: { email, captchaToken: token || undefined } });
      setState('sent');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }
  return (
    <AuthCard title="Reset your password" subtitle="We will email you a link to choose a new password.">
      {state === 'sent' ? (
        <Alert tone="success" title="Check your email">If an account exists for that address, a reset link has been sent. It expires in 30 minutes.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="Email address" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Turnstile onToken={setToken} />
          <button className="btn-primary w-full" disabled={state === 'busy'}>Send reset link</button>
        </form>
      )}
    </AuthCard>
  );
}
