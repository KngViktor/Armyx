'use client';
import { useMemo, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import type { DownloadItem } from '@armyx/shared/content';

export function DocTable({ items, categories }: { items: DownloadItem[]; categories?: Record<string, string> }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const rows = useMemo(() => items.filter((d) => (!cat || d.category === cat) && d.title.toLowerCase().includes(q.toLowerCase())), [items, q, cat]);
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search documents</span>
          <Search aria-hidden className="absolute top-3 left-3 h-5 w-5 text-muted" />
          <input type="search" className="field-input pl-10" placeholder="Search documents" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {categories && (
          <label>
            <span className="sr-only">Category</span>
            <select className="field-input sm:w-56" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
      </div>
      <ul className="mt-6 divide-y divide-olive-100 rounded-xl border border-olive-100">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <FileText aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-olive-600" />
              <div>
                <p className="font-semibold text-olive-900">{d.title}</p>
                <p className="text-xs text-muted">{d.fileType} · {d.sizeKb >= 1024 ? `${(d.sizeKb / 1024).toFixed(1)} MB` : `${d.sizeKb} KB`} · {new Date(d.date).toLocaleDateString('en-NG')}</p>
              </div>
            </div>
            <a href={d.url} className="btn-outline shrink-0" download={d.url.endsWith('.pdf') ? '' : undefined}><Download aria-hidden className="h-4 w-4" /> Download<span className="sr-only"> {d.title}</span></a>
          </li>
        ))}
        {!rows.length && <li className="p-4 text-muted">No documents found.</li>}
      </ul>
    </div>
  );
}
