'use client';
import { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { Institution } from '@armyx/shared/content';

const TYPES: Record<Institution['type'], string> = { academy: 'Academy', depot: 'Depot', school: 'Corps school', college: 'College' };

export function InstitutionDirectory({ items }: { items: Institution[] }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (!type || i.type === type) && (!s || `${i.name} ${i.location} ${i.description} ${i.courses.join(' ')}`.toLowerCase().includes(s)));
  }, [items, q, type]);
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search institutions</span>
          <Search aria-hidden className="absolute top-3 left-3 h-5 w-5 text-muted" />
          <input className="field-input pl-10" type="search" placeholder="Search by name, location or course" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filter by type</span>
          <select className="field-input sm:w-56" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">{results.length} institution{results.length === 1 ? '' : 's'}</p>
      <ul className="mt-4 grid gap-5 md:grid-cols-2">
        {results.map((i) => (
          <li key={i.slug} className="card p-6">
            <span className="badge bg-olive-50 text-olive-800">{TYPES[i.type]}</span>
            <h2 className="mt-3 text-xl font-semibold">{i.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin aria-hidden className="h-4 w-4" />{i.location}</p>
            <p className="mt-3 text-sm">{i.description}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {i.courses.map((c) => <li key={c} className="badge bg-khaki-100 text-olive-900">{c}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
