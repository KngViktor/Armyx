'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { Alert } from '@/components/ui/Alert';

function Audit() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ actor: '', action: '' });
  const [error, setError] = useState('');
  const load = useCallback(async (before?: string) => {
    try {
      const qs = new URLSearchParams(Object.entries({ ...f, before: before ?? '' }).filter(([, v]) => v));
      const r = await api<any[]>(`/admin/audit-logs?${qs}&limit=50`);
      setRows((x) => (before ? [...x, ...r] : r));
    } catch (e) { setError((e as Error).message); }
  }, [f]);
  useEffect(() => { const t = setTimeout(() => load(), 300); return () => clearTimeout(t); }, [load]);
  return (
    <div className="space-y-5">
      <div><h1 className="text-3xl font-bold">Audit log</h1><p className="text-sm text-muted">Append-only record of every administrative action. Entries cannot be edited or deleted.</p></div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 lg:w-2/3">
        <label className="text-sm"><span className="mb-1 block font-semibold">Actor email</span><input className="field-input" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Action starts with</span><input className="field-input" placeholder="e.g. applicant." value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} /></label>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-olive-50"><tr><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">IP</th><th className="p-3">Details</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-t border-olive-100 align-top">
              <td className="p-3 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-NG')}</td>
              <td className="p-3">{r.actor_email ?? '—'}<span className="block text-xs text-muted">{r.actor_role}</span></td>
              <td className="p-3 font-mono text-xs">{r.action}</td>
              <td className="p-3 text-xs">{r.entity_type}<span className="block font-mono text-muted">{r.entity_id?.slice(0, 13)}</span></td>
              <td className="p-3 font-mono text-xs">{r.ip}</td>
              <td className="max-w-xs p-3"><code className="block truncate text-xs" title={JSON.stringify(r.details)}>{JSON.stringify(r.details)}</code></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {rows.length >= 50 && <button className="btn-outline" onClick={() => load(rows[rows.length - 1].id)}>Load older</button>}
    </div>
  );
}
export default function AuditPage() { return <AdminShell><Audit /></AdminShell>; }
