'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApplicant } from '@/components/portal/usePortal';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

export default function SecurityPage() {
  const { me, reload } = useApplicant();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'success', text: ok });
      setSetup(null);
      setCode('');
      reload();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  };

  if (!me) return <div className="container-x py-16 text-muted">Loading…</div>;
  return (
    <div className="container-x max-w-2xl py-10">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-olive-700 underline"><ArrowLeft aria-hidden className="h-4 w-4" />Dashboard</Link>
      <h1 className="mt-4 text-3xl font-bold">Security settings</h1>
      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck aria-hidden className="text-olive-700" />Two-factor authentication</h2>
        <p className="mt-2 text-sm text-muted">Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) when you sign in.</p>
        {msg && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        {me.twoFactorEnabled ? (
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); act(() => api('/auth/2fa/disable', { body: { code } }), 'Two-factor authentication turned off.'); }}>
            <p className="badge bg-green-100 text-success">Enabled</p>
            <TextField label="Enter a current code to turn it off" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="btn-outline">Turn off</button>
          </form>
        ) : setup ? (
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); act(() => api('/auth/2fa/enable', { body: { code } }), 'Two-factor authentication is on.'); }}>
            <p className="text-sm">1. Scan this QR code with your authenticator app:</p>
            <Image src={setup.qrDataUrl} alt="QR code for authenticator app setup" width={200} height={200} unoptimized className="rounded border border-olive-100" />
            <p className="text-sm">Or enter this key manually: <code className="rounded bg-olive-50 px-2 py-1 font-mono text-xs break-all">{setup.secret}</code></p>
            <TextField label="2. Enter the 6-digit code shown in the app" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="btn-primary">Confirm and turn on</button>
          </form>
        ) : (
          <button className="btn-primary mt-5" onClick={async () => setSetup(await api('/auth/2fa/setup', { method: 'POST' }))}>Set up two-factor authentication</button>
        )}
      </section>
    </div>
  );
}
