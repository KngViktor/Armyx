'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { Turnstile } from '@/components/ui/Turnstile';

export default function AdminLogin() {
  const router = useRouter();
  const [stage, setStage] = useState<'password' | 'totp' | 'setup'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [captcha, setCaptcha] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let r: any;
      if (stage === 'setup') r = await api('/admin/auth/mfa/enable', { body: { setupToken, code } });
      else r = await api('/admin/auth/login', { body: { email, password, totp: stage === 'totp' ? code : undefined, captchaToken: captcha || undefined } });
      if (r.ok) return router.replace('/admin');
      if (r.mfaRequired) setStage('totp');
      if (r.mfaSetupRequired) {
        setSetupToken(r.setupToken);
        setQr(await api('/admin/auth/mfa/setup', { body: { setupToken: r.setupToken } }));
        setStage('setup');
      }
      setCode('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-olive-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b-4 border-gold-500 bg-olive-800 p-6 text-white">
          <Image src="/images/crest.png" alt="" width={48} height={48} className="h-12 w-12 rounded-full" />
          <div><h1 className="font-serif text-xl font-bold text-white">Recruitment administration</h1><p className="text-xs text-khaki-100">Authorised personnel only. All activity is logged.</p></div>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          {error && <Alert tone="error">{error}</Alert>}
          {stage === 'password' && (
            <>
              <TextField label="Official email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <Turnstile onToken={setCaptcha} />
            </>
          )}
          {stage === 'setup' && qr && (
            <div className="space-y-3">
              <Alert tone="info" title="Two-factor authentication is mandatory">Scan this QR code with an authenticator app, then enter the 6-digit code to finish signing in.</Alert>
              <Image src={qr.qrDataUrl} alt="Authenticator setup QR code" width={180} height={180} unoptimized className="mx-auto" />
              <p className="text-center text-xs break-all text-muted">Manual key: <code>{qr.secret}</code></p>
            </div>
          )}
          {stage !== 'password' && (
            <TextField label="6-digit authentication code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          )}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : stage === 'password' ? 'Continue' : 'Verify and sign in'}</button>
        </form>
      </div>
    </main>
  );
}
