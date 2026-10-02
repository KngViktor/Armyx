'use client';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download } from 'lucide-react';
import type { Tender } from '@armyx/shared/content';

const STATUS: Record<Tender['status'], string> = {
  open: 'bg-green-100 text-success', closed: 'bg-khaki-100 text-olive-900', awarded: 'bg-olive-700 text-white', cancelled: 'bg-red-100 text-danger',
};

export function TenderList({ tenders }: { tenders: Tender[] }) {
  const [status, setStatus] = useState('');
  const [cat, setCat] = useState('');
  // "Days left" depends on today's date, so compute it on the client after hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const rows = useMemo(() => tenders.filter((t) => (!status || t.status === status) && (!cat || t.category === cat)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), [tenders, status, cat]);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:w-2/3">
        <label><span className="field-label">Status</span>
          <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="open">Open</option><option value="closed">Closed</option><option value="awarded">Awarded</option><option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label><span className="field-label">Category</span>
          <select className="field-input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All</option><option value="works">Works</option><option value="goods">Goods</option><option value="services">Services</option><option value="consultancy">Consultancy</option>
          </select>
        </label>
      </div>
      <ul className="mt-8 space-y-4">
        {rows.map((t) => {
          const days = now === null ? null : Math.ceil((new Date(t.deadline + 'T23:59:59+01:00').getTime() - now) / 86400000);
          return (
            <li key={t.ref} className="card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${STATUS[t.status]}`}>{t.status.toUpperCase()}</span>
                <span className="badge bg-olive-50 text-olive-800">{t.category}</span>
                <span className="font-mono text-xs text-muted">{t.ref}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold">{t.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-olive-100 pt-4 text-sm">
                <p className="flex items-center gap-2"><CalendarClock aria-hidden className="h-4 w-4 text-olive-600" />Deadline: <strong>{new Date(t.deadline).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  {t.status === 'open' && days !== null && <span className={`badge ${days <= 7 ? 'bg-gold-500 text-olive-950' : 'bg-olive-50 text-olive-800'}`}>{days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : 'Closing today'}</span>}
                </p>
                <a href={t.documentUrl} className="btn-outline"><Download aria-hidden className="h-4 w-4" />Tender document</a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
