'use client';
import { useCallback, useEffect, useState } from 'react';
import { ADMIN_ROLES, ROLE_LABELS, type AdminRole } from '@armyx/shared';
import { api } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { Alert } from '@/components/ui/Alert';

function Users() {
  const [rows, setRows] = useState<any[]>([]);
  const [v, setV] = useState({ email: '', fullName: '', role: 'viewer' as AdminRole });
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const load = useCallback(() => api<any[]>('/admin/users').then(setRows).catch((e) => setMsg({ tone: 'error', text: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const update = async (id: string, patch: object) => {
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body: patch }); load(); } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
  };
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Administrator accounts</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <form className="card grid gap-3 p-4 sm:grid-cols-4" onSubmit={async (e) => { e.preventDefault(); try { await api('/admin/users', { body: v }); setMsg({ tone: 'success', text: `Invitation sent to ${v.email}.` }); setV({ email: '', fullName: '', role: 'viewer' }); load(); } catch (err) { setMsg({ tone: 'error', text: (err as Error).message }); } }}>
        <input aria-label="Email" required type="email" placeholder="official@army.mil.ng" className="field-input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <input aria-label="Full name" required placeholder="Full name and rank" className="field-input" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />
        <select aria-label="Role" className="field-input" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as AdminRole })}>{ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
        <button className="btn-primary">Send invitation</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-olive-50"><tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">2FA</th><th className="p-3">Last sign-in</th><th className="p-3">Active</th></tr></thead>
          <tbody>{rows.map((u) => (
            <tr key={u.id} className="border-t border-olive-100">
              <td className="p-3"><span className="font-semibold">{u.full_name}</span><span className="block text-xs text-muted">{u.email}</span></td>
              <td className="p-3"><select aria-label={`Role for ${u.email}`} className="field-input min-h-9 py-1" value={u.role} onChange={(e) => update(u.id, { role: e.target.value })}>{ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></td>
              <td className="p-3">{u.totp_enabled ? <span className="badge bg-green-100 text-success">Enrolled</span> : <span className="badge bg-khaki-100">Pending</span>}</td>
              <td className="p-3 text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-NG') : 'Never'}</td>
              <td className="p-3"><label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-olive-700" checked={u.active} onChange={(e) => update(u.id, { active: e.target.checked })} /><span className="sr-only">Active</span></label></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
export default function UsersPage() { return <AdminShell><Users /></AdminShell>; }
