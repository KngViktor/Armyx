'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Faq } from '@armyx/shared/content';

const CATS: Record<Faq['category'], string> = { general: 'General', eligibility: 'Eligibility', application: 'Application', documents: 'Documents', screening: 'Screening', training: 'Training' };

export function FaqSearch({ faqs }: { faqs: Faq[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return faqs.filter((f) => (!cat || f.category === cat) && words.every((w) => `${f.question} ${f.answer}`.toLowerCase().includes(w)));
  }, [faqs, q, cat]);
  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search frequently asked questions</span>
        <Search aria-hidden className="absolute top-3 left-3 h-5 w-5 text-muted" />
        <input className="field-input pl-10" type="search" placeholder="Search questions, e.g. “height” or “payment”" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {[['', 'All'], ...Object.entries(CATS)].map(([k, v]) => (
          <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={`badge min-h-9 border px-3 ${cat === k ? 'border-olive-700 bg-olive-700 text-white' : 'border-olive-100 bg-white text-olive-800 hover:bg-olive-50'}`}>{v}</button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">{results.length} result{results.length === 1 ? '' : 's'}</p>
      <div className="mt-2 divide-y divide-olive-100 rounded-xl border border-olive-100">
        {results.map((f) => (
          <details key={f.id} className="group p-5 open:bg-olive-50/50">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-olive-900">
              {f.question}
              <ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 leading-7 text-ink">{f.answer}</p>
          </details>
        ))}
        {!results.length && <p className="p-5 text-muted">No questions match your search. <a className="underline" href="/contact">Contact us</a>.</p>}
      </div>
    </div>
  );
}
