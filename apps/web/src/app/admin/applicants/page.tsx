'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarPlus, Download, Filter } from 'lucide-react';
import {
  APPLICATION_STATUSES, ENTRY_TYPE_LABELS, ENTRY_TYPES, NIGERIAN_STATES, QUALIFICATION_LABELS, QUALIFICATIONS, STATE_BY_CODE, STATUS_LABELS,
  type ApplicationStatus,
} from '@armyx/shared';
import { api } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { can, useAdmin } from '@/components/admin/useAdmin';
import { Alert } from '@/components/ui/Alert';

interface Row { id: string; applicationNo: string; surname: string; firstName: string; gender: string; age: number; state: string; lga: string; qualification: string; entryType: string; heightCm: number; status: ApplicationStatus; submittedAt: string }

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  submitted: 'bg-olive-50 text-olive-800', under_review: 'bg-khaki-100 text-olive-950', shortlisted: 'bg-green-100 text-success',
  invited_for_screening: 'bg-olive-700 text-white', rejected: 'bg-red-100 text-danger',
};

function Applicants() {
  const me = useAdmin();
  const [f, setF] = useState({ q: '', state: '', lga: '', qualification: '', entryType: '', status: '', gender: '', sort: 'submitted_at', order: 'desc' });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [screening, setScreening] = useState(false);

  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const load = useCallback(async (more?: string) => {
    setLoading(true);
    try {
      const r = await api<{ items: Row[]; total: number; nextCursor: string | null }>(`/admin/applicants?${qs}&limit=50${more ? `&cursor=${more}` : ''}`);
      setRows((x) => (more ? [...x, ...r.items] : r.items));
      setTotal(r.total);
      setCursor(r.nextCursor);
      if (!more) setSel(new Set());
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [qs]);
  useEffect(() => {
    const t = setTimeout(() => load(), f.q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, f.q]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === 'state' ? { lga: '' } : {}) }));
  const sortBy = (col: string) => setF((x) => ({ ...x, sort: col, order: x.sort === col && x.order === 'desc' ? 'asc' : 'desc' }));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function bulk(status: 'under_review' | 'shortlisted' | 'rejected') {
    if (status === 'rejected' && !confirm(`Reject ${sel.size} applicant(s)? They will be notified by email and SMS.`)) return;
    try {
      const r = await api('/admin/applicants/bulk/status', { body: { ids: [...sel], status } });
      setMsg({ tone: 'success', text: `${r.updated} updated to "${STATUS_LABELS[status]}"${r.skipped ? `, ${r.skipped} skipped (status not eligible for this change)` : ''}.` });
      load();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  }
  async function exportList(format: 'csv' | 'xlsx') {
    const { q, sort, order, ...filter } = f;
    try {
      await api('/admin/exports', { body: { format, filter: Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) } });
      setMsg({ tone: 'success', text: `Export started. Download it from the Exports page when ready.` });
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  }

  const SortH = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th scope="col" aria-sort={f.sort === col ? (f.order === 'asc' ? 'ascending' : 'descending') : 'none'} className="p-3">
      <button type="button" onClick={() => sortBy(col)} className="inline-flex items-center gap-1 font-semibold">{children}{f.sort === col && (f.order === 'asc' ? <ArrowUp aria-hidden className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden className="h-3.5 w-3.5" />)}</button>
    </th>
  );
  const sel2 = (k: keyof typeof f, label: string, options: { value: string; label: string }[]) => (
    <label className="text-sm"><span className="mb-1 block font-semibold">{label}</span>
      <select className="field-input min-h-10 py-1.5 text-sm" value={f[k]} onChange={set(k)}><option value="">All</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Applicants</h1><p className="text-sm text-muted" aria-live="polite">{total.toLocaleString()} matching applicants</p></div>
        {can(me, 'recruitment_officer') && (
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => exportList('csv')}><Download aria-hidden className="h-4 w-4" />CSV</button>
            <button className="btn-outline" onClick={() => exportList('xlsx')}><Download aria-hidden className="h-4 w-4" />Excel</button>
          </div>
        )}
      </div>

      <section className="card p-4" aria-label="Filters">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter aria-hidden className="h-4 w-4" />Search & filter</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Search</span>
            <input type="search" className="field-input min-h-10 py-1.5 text-sm" placeholder="Name, application no., email or phone" value={f.q} onChange={set('q')} />
          </label>
          {sel2('state', 'State', NIGERIAN_STATES.map((s) => ({ value: s.code, label: s.name })))}
          {sel2('lga', 'LGA', (STATE_BY_CODE[f.state]?.lgas ?? []).map((l) => ({ value: l, label: l })))}
          {sel2('qualification', 'Qualification', QUALIFICATIONS.map((q) => ({ value: q, label: QUALIFICATION_LABELS[q].split(' (')[0]! })))}
          {sel2('entryType', 'Entry type', ENTRY_TYPES.map((t) => ({ value: t, label: ENTRY_TYPE_LABELS[t].split(' (')[0]! })))}
          {sel2('status', 'Status', APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })))}
          {sel2('gender', 'Gender', [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }])}
        </div>
      </section>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {sel.size > 0 && can(me, 'reviewer', 'recruitment_officer') && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg bg-olive-900 p-3 text-white shadow-lg" role="region" aria-label="Bulk actions">
          <span className="mr-2 text-sm font-semibold">{sel.size} selected</span>
          <button className="btn min-h-9 bg-white/10 py-1.5 hover:bg-white/20" onClick={() => bulk('under_review')}>Mark under review</button>
          <button className="btn min-h-9 bg-gold-500 py-1.5 text-olive-950 hover:bg-gold-300" onClick={() => bulk('shortlisted')}>Shortlist</button>
          <button className="btn min-h-9 bg-danger py-1.5 hover:opacity-90" onClick={() => bulk('rejected')}>Reject</button>
          {can(me, 'recruitment_officer') && <button className="btn min-h-9 bg-white py-1.5 text-olive-900" onClick={() => setScreening(true)}><CalendarPlus aria-hidden className="h-4 w-4" />Assign screening</button>}
          <button className="ml-auto text-sm underline" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      {screening && <ScreeningDialog ids={[...sel]} onClose={(r) => { setScreening(false); if (r) { setMsg({ tone: 'success', text: r }); load(); } }} />}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <caption className="sr-only">Applicants</caption>
          <thead className="bg-olive-50 text-olive-900">
            <tr>
              <th scope="col" className="w-10 p-3"><input type="checkbox" aria-label="Select all on this page" className="h-4 w-4 accent-olive-700" checked={rows.length > 0 && rows.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
              <th scope="col" className="p-3">Application no.</th>
              <SortH col="surname">Name</SortH>
              <SortH col="state">State / LGA</SortH>
              <th scope="col" className="p-3">Qualification</th>
              <th scope="col" className="p-3">Entry</th>
              <SortH col="height_cm">Height</SortH>
              <SortH col="status">Status</SortH>
              <SortH col="submitted_at">Submitted</SortH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-olive-100 ${sel.has(r.id) ? 'bg-gold-300/20' : 'hover:bg-olive-50/50'}`}>
                <td className="p-3"><input type="checkbox" aria-label={`Select ${r.surname} ${r.firstName}`} className="h-4 w-4 accent-olive-700" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="p-3 font-mono text-xs">{can(me, 'reviewer', 'recruitment_officer') ? <Link className="text-olive-700 underline" href={`/admin/applicant?id=${r.id}`}>{r.applicationNo}</Link> : r.applicationNo}</td>
                <td className="p-3"><span className="font-semibold">{r.surname}</span> {r.firstName}<span className="block text-xs text-muted">{r.gender}, {r.age} yrs</span></td>
                <td className="p-3">{STATE_BY_CODE[r.state]?.name}<span className="block text-xs text-muted">{r.lga}</span></td>
                <td className="p-3">{r.qualification.toUpperCase()}</td>
                <td className="p-3">{ENTRY_TYPE_LABELS[r.entryType as keyof typeof ENTRY_TYPE_LABELS]?.split(' (')[0]}</td>
                <td className="p-3 tabular-nums">{(r.heightCm / 100).toFixed(2)}m</td>
                <td className="p-3"><span className={`badge ${STATUS_STYLE[r.status]}`}>{STATUS_LABELS[r.status]}</span></td>
                <td className="p-3 text-xs whitespace-nowrap">{new Date(r.submittedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td colSpan={9} className="p-6 text-center text-muted">No applicants match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center">
        {cursor && <button className="btn-outline" disabled={loading} onClick={() => load(cursor)}>{loading ? 'Loading…' : 'Load more'}</button>}
      </div>
    </div>
  );
}

function ScreeningDialog({ ids, onClose }: { ids: string[]; onClose: (result?: string) => void }) {
  const [centres, setCentres] = useState<{ id: string; name: string; state_code: string }[]>([]);
  const [centreId, setCentreId] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api<any[]>('/admin/exercises').then(async (ex) => {
      const open = ex.find((e) => e.state === 'open') ?? ex[0];
      if (open) setCentres(await api(`/admin/exercises/${open.id}/centres`));
    });
  }, []);
  async function assign(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api('/admin/applicants/bulk/screening', { body: { ids, centreId, screeningDate: new Date(date).toISOString() } });
      onClose(`${r.updated} applicant(s) invited for screening${r.skipped ? `; ${r.skipped} skipped (must be shortlisted first)` : ''}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="scr-title">
      <form onSubmit={assign} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-2xl">
        <h2 id="scr-title" className="text-xl font-bold">Assign screening ({ids.length})</h2>
        <p className="text-sm text-muted">Only shortlisted applicants are invited. They are notified by email and SMS.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <label className="block"><span className="field-label">Screening centre</span>
          <select required className="field-input" value={centreId} onChange={(e) => setCentreId(e.target.value)}>
            <option value="">Select…</option>{centres.map((c) => <option key={c.id} value={c.id}>{c.name} ({STATE_BY_CODE[c.state_code]?.name})</option>)}
          </select>
        </label>
        <label className="block"><span className="field-label">Date and time</span><input required type="datetime-local" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => onClose()}>Cancel</button><button className="btn-primary">Assign</button></div>
      </form>
    </div>
  );
}

export default function ApplicantsPage() {
  return <AdminShell><Applicants /></AdminShell>;
}
