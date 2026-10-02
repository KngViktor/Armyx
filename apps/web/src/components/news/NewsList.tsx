'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { NewsItem } from '@armyx/shared/content';

export function NewsList({ items, labels }: { items: NewsItem[]; labels: Record<string, string> }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [year, setYear] = useState('');
  const years = [...new Set(items.map((n) => n.publishedAt.slice(0, 4)))].sort().reverse();
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items
      .filter((n) => (!cat || n.category === cat) && (!year || n.publishedAt.startsWith(year)))
      .filter((n) => words.every((w) => `${n.title} ${n.excerpt} ${n.body.join(' ')}`.toLowerCase().includes(w)))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }, [items, q, cat, year]);

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <aside className="lg:col-span-3">
        <div className="space-y-5 lg:sticky lg:top-28">
          <label className="relative block">
            <span className="field-label">Search</span>
            <Search aria-hidden className="absolute bottom-3 left-3 h-5 w-5 text-muted" />
            <input type="search" className="field-input pl-10" placeholder="Keywords" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <fieldset>
            <legend className="field-label">Category</legend>
            <ul className="space-y-1">
              {[['', 'All categories'], ...Object.entries(labels)].map(([k, v]) => (
                <li key={k}>
                  <button type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${cat === k ? 'bg-olive-700 font-semibold text-white' : 'hover:bg-olive-50'}`}>
                    {v} <span className="float-right opacity-70">{k ? items.filter((n) => n.category === k).length : items.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
          <label className="block">
            <span className="field-label">Year</span>
            <select className="field-input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </aside>
      <div className="lg:col-span-9">
        <p className="text-sm text-muted" aria-live="polite">{results.length} item{results.length === 1 ? '' : 's'}</p>
        <ul className="mt-4 grid gap-6 sm:grid-cols-2">
          {results.map((n) => (
            <li key={n.slug}>
              <Link href={`/news/${n.slug}`} className="card group flex h-full flex-col overflow-hidden">
                <span className="relative block aspect-video"><Image src={n.image} alt="" fill sizes="(min-width:1024px) 35vw, 100vw" className="object-cover" /></span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="text-xs font-semibold tracking-wide text-olive-600 uppercase">{labels[n.category]} · <time dateTime={n.publishedAt}>{new Date(n.publishedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</time></span>
                  <span className="mt-2 font-serif text-lg font-semibold text-olive-900 group-hover:underline">{n.title}</span>
                  <span className="mt-2 line-clamp-3 text-sm text-muted">{n.excerpt}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!results.length && <p className="card mt-4 p-6 text-muted">No press releases match your filters.</p>}
      </div>
    </div>
  );
}
