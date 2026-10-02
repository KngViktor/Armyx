'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DEFAULT_RULES, ENTRY_TYPE_LABELS, ENTRY_TYPES, NIGERIAN_STATES, QUALIFICATION_LABELS, QUALIFICATIONS, STATE_BY_CODE, type EligibilityRules } from '@armyx/shared';
import { api } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { can, useAdmin } from '@/components/admin/useAdmin';
import { Alert } from '@/components/ui/Alert';

interface Exercise { id: string; code: string; title: string; state: string; opens_at: string; closes_at: string; rules: EligibilityRules; quotas: Record<string, number>; applications: number }
const local = (iso: string) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function ExerciseEditor({ ex, onSaved }: { ex: Partial<Exercise> | null; onSaved: () => void }) {
  const editable = can(useAdmin(), 'recruitment_officer');
  const [v, setV] = useState(() => ({
    code: ex?.code ?? '', title: ex?.title ?? '', opensAt: ex?.opens_at ? local(ex.opens_at) : '', closesAt: ex?.closes_at ? local(ex.closes_at) : '',
    rules: structuredClone(ex?.rules ?? DEFAULT_RULES), quotas: { ...(ex?.quotas ?? {}) } as Record<string, number>,
  }));
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const rule = (t: keyof EligibilityRules, k: string, val: any) => setV((x) => ({ ...x, rules: { ...x.rules, [t]: { ...x.rules[t], [k]: val } } }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = { code: v.code, title: v.title, opensAt: new Date(v.opensAt).toISOString(), closesAt: new Date(v.closesAt).toISOString(), rules: v.rules, quotas: Object.fromEntries(Object.entries(v.quotas).filter(([, n]) => n > 0)) };
      await api(ex?.id ? `/admin/exercises/${ex.id}` : '/admin/exercises', { method: ex?.id ? 'PUT' : 'POST', body });
      setMsg({ tone: 'success', text: 'Saved. Rules take effect on the portal within a minute.' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    }
  }
  const num = (t: keyof EligibilityRules, k: string, label: string) => (
    <label className="text-sm"><span className="mb-1 block text-muted">{label}</span><input type="number" disabled={!editable} className="field-input min-h-9 py-1" value={(v.rules[t] as any)[k]} onChange={(e) => rule(t, k, Number(e.target.value))} /></label>
  );
  return (
    <form onSubmit={save} className="space-y-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm"><span className="field-label">Code</span><input className="field-input" required pattern="[A-Z0-9-]{3,20}" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} /></label>
        <label className="text-sm lg:col-span-3"><span className="field-label">Title</span><input className="field-input" required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label className="text-sm"><span className="field-label">Opens</span><input type="datetime-local" className="field-input" required value={v.opensAt} onChange={(e) => setV({ ...v, opensAt: e.target.value })} /></label>
        <label className="text-sm"><span className="field-label">Closes</span><input type="datetime-local" className="field-input" required value={v.closesAt} onChange={(e) => setV({ ...v, closesAt: e.target.value })} /></label>
      </fieldset>
      <div>
        <h3 className="font-sans text-base font-semibold">Eligibility rules</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {ENTRY_TYPES.map((t) => (
            <fieldset key={t} disabled={!editable} className="rounded-lg border border-olive-100 p-4">
              <legend className="px-1 font-semibold">{ENTRY_TYPE_LABELS[t]}</legend>
              <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-olive-700" checked={v.rules[t].enabled} onChange={(e) => rule(t, 'enabled', e.target.checked)} />Open for this exercise</label>
              <div className="grid grid-cols-2 gap-3">
                {num(t, 'minAge', 'Min age')}{num(t, 'maxAge', 'Max age')}{num(t, 'minHeightMaleCm', 'Min height male (cm)')}{num(t, 'minHeightFemaleCm', 'Min height female (cm)')}{num(t, 'minCredits', 'Min credits')}{num(t, 'maxSittings', 'Max sittings')}
                <label className="col-span-2 text-sm"><span className="mb-1 block text-muted">Minimum qualification</span>
                  <select className="field-input min-h-9 py-1" value={v.rules[t].minQualification} onChange={(e) => rule(t, 'minQualification', e.target.value)}>{QUALIFICATIONS.map((q) => <option key={q} value={q}>{QUALIFICATION_LABELS[q]}</option>)}</select>
                </label>
                <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-olive-700" checked={v.rules[t].requireEnglishAndMaths} onChange={(e) => rule(t, 'requireEnglishAndMaths', e.target.checked)} />English & Maths required</label>
                <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-olive-700" checked={v.rules[t].singleOnly} onChange={(e) => rule(t, 'singleOnly', e.target.checked)} />Single applicants only</label>
              </div>
            </fieldset>
          ))}
        </div>
      </div>
      <details className="rounded-lg border border-olive-100 p-4">
        <summary className="cursor-pointer font-semibold">Shortlisting quotas per state ({Object.values(v.quotas).filter((n) => n > 0).length} set)</summary>
        <p className="mt-2 text-xs text-muted">Maximum shortlisted + invited applicants per state of origin. 0 or empty = no limit.</p>
        <fieldset disabled={!editable} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {NIGERIAN_STATES.map((s) => (
            <label key={s.code} className="text-xs"><span className="mb-1 block">{s.name}</span><input type="number" min={0} className="field-input min-h-9 py-1" value={v.quotas[s.code] ?? ''} onChange={(e) => setV({ ...v, quotas: { ...v.quotas, [s.code]: Number(e.target.value) } })} /></label>
          ))}
        </fieldset>
      </details>
      {editable && <button className="btn-primary">{ex?.id ? 'Save changes' : 'Create exercise'}</button>}
    </form>
  );
}

function Centres({ exerciseId }: { exerciseId: string }) {
  const editable = can(useAdmin(), 'recruitment_officer');
  const [rows, setRows] = useState<any[]>([]);
  const [v, setV] = useState({ name: '', stateCode: '', address: '', capacityPerDay: 500 });
  const [error, setError] = useState('');
  const load = useCallback(() => api(`/admin/exercises/${exerciseId}/centres`).then(setRows), [exerciseId]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-olive-50"><tr><th className="p-2">Centre</th><th className="p-2">State</th><th className="p-2">Address</th><th className="p-2">Capacity/day</th><th className="p-2">Assigned</th><th className="p-2"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} className="border-t border-olive-100"><td className="p-2 font-semibold">{c.name}</td><td className="p-2">{STATE_BY_CODE[c.state_code]?.name}</td><td className="p-2">{c.address}</td><td className="p-2">{c.capacity_per_day}</td><td className="p-2">{c.assigned}</td>
              <td className="p-2">{editable && <button className="text-danger" aria-label={`Delete ${c.name}`} onClick={async () => { try { await api(`/admin/exercises/centres/${c.id}`, { method: 'DELETE' }); load(); } catch (e) { setError((e as Error).message); } }}><Trash2 aria-hidden className="h-4 w-4" /></button>}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {editable && (
        <form className="grid gap-3 rounded-lg border border-dashed border-khaki-500 p-4 sm:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); try { await api(`/admin/exercises/${exerciseId}/centres`, { body: v }); setV({ name: '', stateCode: '', address: '', capacityPerDay: 500 }); load(); } catch (err) { setError((err as Error).message); } }}>
          <input aria-label="Centre name" required placeholder="Centre name" className="field-input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <select aria-label="State" required className="field-input" value={v.stateCode} onChange={(e) => setV({ ...v, stateCode: e.target.value })}><option value="">State…</option>{NIGERIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
          <input aria-label="Address" required placeholder="Address" className="field-input" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
          <input aria-label="Capacity per day" type="number" min={1} className="field-input" value={v.capacityPerDay} onChange={(e) => setV({ ...v, capacityPerDay: Number(e.target.value) })} />
          <button className="btn-primary"><Plus aria-hidden className="h-4 w-4" />Add centre</button>
        </form>
      )}
    </div>
  );
}

function Exercises() {
  const me = useAdmin();
  const [list, setList] = useState<Exercise[]>([]);
  const [active, setActive] = useState<string | 'new' | null>(null);
  const [tab, setTab] = useState<'rules' | 'centres'>('rules');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api<Exercise[]>('/admin/exercises').then((l) => { setList(l); setActive((a) => a ?? l[0]?.id ?? null); }), []);
  useEffect(() => { load(); }, [load]);
  const ex = list.find((e) => e.id === active);
  const setState = async (id: string, s: 'open' | 'close') => {
    if (!confirm(s === 'open' ? 'Open this exercise to the public now?' : 'Close this exercise? Applicants will no longer be able to apply.')) return;
    try { await api(`/admin/exercises/${id}/${s}`, { method: 'POST' }); setMsg(''); load(); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Recruitment exercises</h1>
        {can(me, 'recruitment_officer') && <button className="btn-primary" onClick={() => setActive('new')}><Plus aria-hidden className="h-4 w-4" />New exercise</button>}
      </div>
      {msg && <Alert tone="error">{msg}</Alert>}
      <div className="grid gap-5 xl:grid-cols-12">
        <ul className="space-y-2 xl:col-span-3">
          {list.map((e) => (
            <li key={e.id}>
              <button onClick={() => setActive(e.id)} className={`card w-full p-4 text-left ${active === e.id ? 'border-olive-700 ring-2 ring-olive-700/20' : ''}`}>
                <span className={`badge ${e.state === 'open' ? 'bg-green-100 text-success' : e.state === 'closed' ? 'bg-khaki-100' : 'bg-olive-50'}`}>{e.state}</span>
                <span className="mt-2 block font-semibold">{e.title}</span>
                <span className="block text-xs text-muted">{e.code} · {e.applications.toLocaleString()} applications</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="card p-5 xl:col-span-9">
          {active === 'new' ? (
            <><h2 className="mb-4 text-xl font-bold">New exercise</h2><ExerciseEditor ex={null} onSaved={load} /></>
          ) : ex ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{ex.title}</h2>
                {can(me, 'recruitment_officer') && (ex.state === 'open'
                  ? <button className="btn bg-danger text-white" onClick={() => setState(ex.id, 'close')}>Close exercise</button>
                  : <button className="btn-gold" onClick={() => setState(ex.id, 'open')}>Open exercise</button>)}
              </div>
              <div role="tablist" className="mb-5 flex gap-2 border-b border-olive-100">
                {(['rules', 'centres'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t ? 'border-olive-700 text-olive-900' : 'border-transparent text-muted'}`}>{t === 'rules' ? 'Rules & quotas' : 'Screening centres'}</button>)}
              </div>
              {tab === 'rules' ? <ExerciseEditor key={ex.id} ex={ex} onSaved={load} /> : <Centres exerciseId={ex.id} />}
            </>
          ) : <p className="text-muted">No exercises yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  return <AdminShell><Exercises /></AdminShell>;
}
