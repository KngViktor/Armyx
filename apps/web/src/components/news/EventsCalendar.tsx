'use client';
/** Month calendar + agenda list. The grid is decorative-plus-navigable; the agenda list is the accessible source of truth. */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import type { EventItem } from '@armyx/shared/content';

const CAT_COLOURS: Record<EventItem['category'], string> = {
  ceremony: 'bg-gold-500 text-olive-950', recruitment: 'bg-olive-700 text-white', sports: 'bg-khaki-500 text-olive-950',
  community: 'bg-olive-500 text-white', training: 'bg-olive-900 text-white',
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function EventsCalendar({ events }: { events: EventItem[] }) {
  const first = events.map((e) => e.date).sort().find((d) => d >= iso(new Date())) ?? iso(new Date());
  const [month, setMonth] = useState(() => new Date(first.slice(0, 7) + '-01T00:00:00Z'));
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = new Date(month);
    start.setUTCDate(1 - ((start.getUTCDay() + 6) % 7)); // Monday-first grid
    return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86400000));
  }, [month]);
  const on = (d: string) => events.filter((e) => e.date <= d && (e.endDate ?? e.date) >= d);
  const monthKey = iso(month).slice(0, 7);
  const agenda = events
    .filter((e) => (selected ? on(selected).includes(e) : e.date.startsWith(monthKey) || (e.endDate ?? '').startsWith(monthKey)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const label = month.toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shift = (n: number) => { const m = new Date(month); m.setUTCMonth(m.getUTCMonth() + n); setMonth(m); setSelected(null); };

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="card p-4 sm:p-6 lg:col-span-7">
        <div className="flex items-center justify-between">
          <button type="button" className="btn-outline px-3" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft aria-hidden /></button>
          <h2 className="text-xl font-semibold" aria-live="polite">{label}</h2>
          <button type="button" className="btn-outline px-3" onClick={() => shift(1)} aria-label="Next month"><ChevronRight aria-hidden /></button>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-muted" aria-hidden>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = iso(d);
            const ev = on(k);
            const inMonth = k.startsWith(monthKey);
            return (
              <button key={k} type="button" disabled={!ev.length} onClick={() => setSelected(selected === k ? null : k)} aria-pressed={selected === k}
                aria-label={`${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', timeZone: 'UTC' })}${ev.length ? `, ${ev.length} event(s)` : ''}`}
                className={`flex aspect-square flex-col items-center justify-start rounded-md p-1 text-sm ${inMonth ? '' : 'opacity-35'} ${selected === k ? 'ring-2 ring-gold-500' : ''} ${ev.length ? 'bg-olive-50 font-semibold hover:bg-olive-100' : ''} ${k === iso(new Date()) ? 'border border-olive-700' : ''}`}>
                {d.getUTCDate()}
                <span className="mt-auto flex gap-0.5">{ev.slice(0, 3).map((e) => <span key={e.slug} className={`h-1.5 w-1.5 rounded-full ${CAT_COLOURS[e.category].split(' ')[0]}`} />)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="lg:col-span-5">
        <h2 className="text-xl font-semibold">{selected ? `Events on ${new Date(selected).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })}` : `Events in ${label}`}</h2>
        <ul className="mt-4 space-y-3">
          {agenda.map((e) => (
            <li key={e.slug} className="card p-4">
              <span className={`badge ${CAT_COLOURS[e.category]}`}>{e.category}</span>
              <p className="mt-2 font-semibold text-olive-900">{e.title}</p>
              <p className="mt-1 text-sm text-muted">{new Date(e.date).toDateString()}{e.endDate && ` – ${new Date(e.endDate).toDateString()}`}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin aria-hidden className="h-4 w-4" />{e.location}</p>
              <p className="mt-2 text-sm">{e.description}</p>
            </li>
          ))}
          {!agenda.length && <li className="text-muted">No events scheduled.</li>}
        </ul>
      </div>
    </div>
  );
}
