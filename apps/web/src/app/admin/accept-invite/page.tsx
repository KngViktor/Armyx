'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { PasswordStrength } from '@/components/portal/PasswordStrength';

function Inner() {
  const sp = useSearchParams();
  const [pw, setPw] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  if (done) return <Alert tone="success" title="Password set">You can now <Link className="underline" href="/admin/login">sign in</Link>. You will be asked to set up two-factor authentication.</Alert>;
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await api('/admin/auth/accept-invite', { body: { token: sp.get('token'), password: pw } }); setDone(true); } catch (err) { setError((err as Error).message); } }}>
      {error && <Alert tone="error">{error}</Alert>}
      <div><TextField label="Choose a password" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /><PasswordStrength value={pw} /></div>
      <button className="btn-primary w-full">Set password</button>
    </form>
  );
}

export default function AcceptInvite() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-olive-950 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h1 className="mb-4 text-2xl font-bold">Activate administrator account</h1>
        <Suspense><Inner /></Suspense>
      </div>
    </main>
  );
}
