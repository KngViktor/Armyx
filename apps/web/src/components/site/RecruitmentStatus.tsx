'use client';
/**
 * Live recruitment window status on otherwise static pages. Reads the public,
 * CDN-cached /reference/exercise endpoint (30s TTL) — cheap even in a spike.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarClock, ArrowRight } from 'lucide-react';

interface Ex { open: boolean; title?: string; closesAt?: string; opensAt?: string }

export function RecruitmentStatus({ variant = 'card' }: { variant?: 'card' | 'inline' }) {
  const [ex, setEx] = useState<Ex | null>(null);
  useEffect(() => {
    fetch((process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1') + '/reference/exercise')
      .then((r) => (r.ok ? r.json() : { open: false }))
      .then(setEx)
      .catch(() => setEx({ open: false }));
  }, []);
  const closes = ex?.closesAt ? new Date(ex.closesAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  if (variant === 'inline') {
    return (
      <p className="text-sm text-khaki-100" aria-live="polite">
        {ex === null ? 'Checking recruitment status…' : ex.open ? <>Applications open — closes <strong className="text-gold-300">{closes}</strong></> : 'No recruitment exercise is open at the moment.'}
      </p>
    );
  }
  return (
    <div className="card overflow-hidden" aria-live="polite">
      <div className="flex items-center gap-2 bg-olive-800 px-5 py-3 text-sm font-semibold text-white">
        <CalendarClock aria-hidden className="h-4 w-4 text-gold-300" /> Recruitment status
      </div>
      <div className="p-5">
        {ex === null ? (
          <p className="text-muted">Checking…</p>
        ) : ex.open ? (
          <>
            <p className="badge bg-green-100 text-success">Open now</p>
            <p className="mt-3 font-serif text-xl font-semibold text-olive-900">{ex.title}</p>
            <p className="mt-1 text-sm text-muted">Closing date: <strong className="text-ink">{closes}</strong></p>
            <Link href="/portal/register" className="btn-primary mt-4 w-full">Start application <ArrowRight aria-hidden className="h-4 w-4" /></Link>
          </>
        ) : (
          <>
            <p className="badge bg-khaki-100 text-olive-900">Closed</p>
            <p className="mt-3 text-sm text-muted">No recruitment exercise is open. Watch this page and our official channels for announcements.</p>
            <Link href="/join/eligibility" className="btn-outline mt-4 w-full">Check eligibility</Link>
          </>
        )}
        <p className="mt-4 border-t border-olive-100 pt-3 text-xs text-muted">Recruitment is <strong>free</strong>. The Army never asks for payment.</p>
      </div>
    </div>
  );
}
