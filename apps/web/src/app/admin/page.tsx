'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ENTRY_TYPE_LABELS, STATE_BY_CODE, STATUS_LABELS, type ApplicationStatus, type EntryType } from '@armyx/shared';
import { api } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { BarList, ColumnChart, StatTile } from '@/components/admin/Charts';

interface Dash {
  total: number; lastHour: number; pendingSubmissions: number; byState: Record<string, number>; byStatus: Record<string, number>;
  byEntryType: Record<string, number>; daily: { date: string; count: number }[]; generatedAt: string;
}

function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const load = () => api<Dash>('/admin/dashboard').then((x) => { setD(x); setError(''); }).catch((e) => setError(e.message)).finally(() => { t = setTimeout(load, 15_000); });
    load();
    return () => clearTimeout(t);
  }, []);
  if (!d) return <p className="text-muted">{error || 'Loading dashboard…'}</p>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Recruitment dashboard</h1><p className="text-sm text-muted">Live figures, refreshed every 15 seconds.</p></div>
        <p className="flex items-center gap-1 text-xs text-muted" aria-live="polite"><RefreshCw aria-hidden className="h-3.5 w-3.5" />Updated {new Date(d.generatedAt).toLocaleTimeString('en-NG')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total applications" value={d.total} />
        <StatTile label="Submitted in the last hour" value={d.lastHour} />
        <StatTile label="Shortlisted + invited" value={(d.byStatus.shortlisted ?? 0) + (d.byStatus.invited_for_screening ?? 0)} />
        <StatTile label="Submissions being processed" value={d.pendingSubmissions} sub="Background queue depth" />
      </div>
      <ColumnChart title="Applications per day" data={d.daily.slice(-30).map((x) => ({ label: x.date, value: x.count }))} />
      <div className="grid gap-6 xl:grid-cols-2">
        <BarList title="Applications by state of origin" total={d.total} data={Object.entries(d.byState).map(([k, v]) => ({ label: STATE_BY_CODE[k]?.name ?? k, value: v }))} />
        <div className="space-y-6">
          <BarList title="Applications by status" total={d.total} data={Object.entries(d.byStatus).map(([k, v]) => ({ label: STATUS_LABELS[k as ApplicationStatus] ?? k, value: v }))} />
          <BarList title="Applications by entry type" total={d.total} data={Object.entries(d.byEntryType).map(([k, v]) => ({ label: ENTRY_TYPE_LABELS[k as EntryType]?.split(' (')[0] ?? k, value: v }))} />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <AdminShell><Dashboard /></AdminShell>;
}
