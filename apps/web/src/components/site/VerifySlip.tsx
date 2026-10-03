'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

export function VerifySlip() {
  const sp = useSearchParams();
  const id = sp.get('id');
  const s = sp.get('s');
  const [r, setR] = useState<null | { valid: boolean; applicationNo?: string; name?: string; exercise?: string; status?: string }>(null);
  // The page is prerendered without a query string; render the same neutral markup until hydrated.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!id || !s) return;
    api(`/verify?id=${encodeURIComponent(id)}&s=${encodeURIComponent(s)}`, { maxRetries: 1 })
      .then(setR)
      .catch(() => setR({ valid: false }));
  }, [id, s]);
  if (!mounted) return <p className="card p-6" aria-live="polite">Loading…</p>;
  if (!id || !s) return <p className="card p-6 text-muted">Scan the QR code printed on the slip with your phone camera to open this page with the slip details.</p>;
  if (!r) return <p className="card p-6" aria-live="polite">Verifying…</p>;
  return r.valid ? (
    <div className="card border-t-4 border-t-success p-6" role="status">
      <p className="flex items-center gap-2 text-xl font-semibold text-success"><ShieldCheck aria-hidden /> Genuine slip</p>
      <dl className="mt-4 grid grid-cols-3 gap-y-2 text-sm">
        <dt className="text-muted">Application no.</dt><dd className="col-span-2 font-mono font-semibold">{r.applicationNo}</dd>
        <dt className="text-muted">Name</dt><dd className="col-span-2">{r.name}</dd>
        <dt className="text-muted">Exercise</dt><dd className="col-span-2">{r.exercise}</dd>
        <dt className="text-muted">Current status</dt><dd className="col-span-2 font-semibold">{r.status}</dd>
      </dl>
    </div>
  ) : (
    <div className="card border-t-4 border-t-danger p-6" role="alert">
      <p className="flex items-center gap-2 text-xl font-semibold text-danger"><ShieldAlert aria-hidden /> Could not verify this slip</p>
      <p className="mt-2 text-sm">The slip may be forged or altered. Screening officers should refer the candidate to the recruitment desk.</p>
    </div>
  );
}
