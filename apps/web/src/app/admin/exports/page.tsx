'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';

function Exports() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const load = () => api<any[]>('/admin/exports').then((r) => { setRows(r); if (r.some((x) => x.status === 'queued' || x.status === 'running')) t = setTimeout(load, 3000); });
    load();
    return () => clearTimeout(t);
  }, []);
  const download = async (id: string) => window.open((await api(`/admin/exports/${id}/download`)).url, '_blank', 'noopener');
  return (
    <div className="space-y-5">
      <div><h1 className="text-3xl font-bold">Exports</h1><p className="text-sm text-muted">Start an export from the Applicants page. Files are available for 30 days; download links expire after 2 minutes.</p></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-olive-50"><tr><th className="p-3">Requested</th><th className="p-3">Format</th><th className="p-3">Status</th><th className="p-3">Rows</th><th className="p-3"><span className="sr-only">Download</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-olive-100">
                <td className="p-3">{new Date(r.created_at).toLocaleString('en-NG')}</td><td className="p-3 uppercase">{r.format}</td>
                <td className="p-3"><span className={`badge ${r.status === 'done' ? 'bg-green-100 text-success' : r.status === 'failed' ? 'bg-red-100 text-danger' : 'bg-khaki-100'}`}>{r.status}</span>{r.error && <span className="block text-xs text-danger">{r.error}</span>}</td>
                <td className="p-3 tabular-nums">{r.row_count?.toLocaleString() ?? '—'}</td>
                <td className="p-3">{r.status === 'done' && <button className="btn-outline min-h-9 py-1" onClick={() => download(r.id)}><Download aria-hidden className="h-4 w-4" />Download</button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-muted">No exports yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function ExportsPage() { return <AdminShell><Exports /></AdminShell>; }
