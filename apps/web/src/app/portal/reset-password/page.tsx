'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { passwordSchema } from '@armyx/shared';
import { api } from '@/lib/api';
import { AuthCard } from '@/components/portal/usePortal';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { PasswordStrength } from '@/components/portal/PasswordStrength';

function ResetInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordSchema.safeParse(pw);
    if (!p.success) return setError(p.error.issues[0]!.message);
    if (pw !== confirm) return setError('Passwords do not match');
    try {
      await api('/auth/password/reset', { body: { token: sp.get('token') ?? '', password: pw } });
      router.push('/portal/login?reset=1');
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <div><TextField label="New password" type="password" required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><PasswordStrength value={pw} /></div>
      <TextField label="Confirm new password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <button className="btn-primary w-full">Change password</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return <AuthCard title="Choose a new password"><Suspense><ResetInner /></Suspense></AuthCard>;
}
