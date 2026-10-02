'use client';
/** Shown while the API client is waiting out load shedding / the edge waiting room. */
import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';
import type { QueueEvent } from '@/lib/api';

export function QueueBanner() {
  const [q, setQ] = useState<QueueEvent>({ active: false });
  useEffect(() => {
    const h = (e: Event) => setQ((e as CustomEvent<QueueEvent>).detail);
    window.addEventListener('armyx:queue', h);
    return () => window.removeEventListener('armyx:queue', h);
  }, []);
  if (!q.active) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-0 z-[60] border-t-4 border-gold-500 bg-olive-900 text-white shadow-2xl">
      <div className="container-x flex items-center gap-3 py-4">
        <Hourglass aria-hidden className="h-6 w-6 shrink-0 animate-pulse text-gold-300" />
        <p className="text-sm">
          <strong>High demand right now.</strong> You are in the queue — please keep this page open. Your progress is saved.
          {q.retryInSec ? ` Retrying in about ${q.retryInSec}s.` : ''}
        </p>
      </div>
    </div>
  );
}
