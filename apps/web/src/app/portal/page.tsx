'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Download, FileCheck2, LogOut, MapPin, ShieldCheck } from 'lucide-react';
import { APPLICATION_STEPS, STATUS_LABELS, type ApplicationStatus } from '@armyx/shared';
import { api } from '@/lib/api';
import { useApplicant } from '@/components/portal/usePortal';
import { StatusTimeline } from '@/components/portal/StatusTimeline';
import { Alert } from '@/components/ui/Alert';

interface AppStatus {
  applicationNo: string; status: ApplicationStatus | 'processing'; submittedAt: string; slipReady?: boolean;
  screening?: { date: string; centre: string; address: string } | null;
}

export default function PortalDashboard() {
  const { me, logout } = useApplicant();
  const [app, setApp] = useState<AppStatus | null | undefined>(undefined);
  const [draft, setDraft] = useState<{ exercise: any; stepsDone?: string[]; documents?: unknown[] } | null>(null);
  const [slipMsg, setSlipMsg] = useState('');

  useEffect(() => {
    if (!me) return;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const s = await api<{ application: AppStatus | null }>('/applications/me');
      setApp(s.application);
      if (!s.application) setDraft(await api('/applications/draft'));
      // While the submission is being processed (or the slip generated), poll gently.
      if (s.application && (s.application.status === 'processing' || !s.application.slipReady)) timer = setTimeout(load, 4000);
    };
    load().catch(() => setApp(null));
    return () => clearTimeout(timer);
  }, [me]);

  async function downloadSlip() {
    setSlipMsg('');
    const r = await api<{ url?: string; pending?: boolean }>('/applications/me/slip');
    if (r.url) window.open(r.url, '_blank', 'noopener');
    else setSlipMsg('Your slip is being generated. Please try again in a minute.');
  }

  if (!me || app === undefined) return <div className="container-x py-16 text-muted" aria-live="polite">Loading your dashboard…</div>;

  const progress = draft?.stepsDone ? Math.round(((draft.stepsDone.length + (draft.documents?.length ? 1 : 0)) / (APPLICATION_STEPS.length + 1)) * 100) : 0;

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Welcome,</p>
          <h1 className="text-3xl font-bold">{me.firstName} {me.surname}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/portal/security" className="btn-outline"><ShieldCheck aria-hidden className="h-4 w-4" />Security</Link>
          <button onClick={logout} className="btn-outline"><LogOut aria-hidden className="h-4 w-4" />Sign out</button>
        </div>
      </div>

      {!me.twoFactorEnabled && (
        <div className="mt-6"><Alert tone="info" title="Protect your account">Turn on two-factor authentication in <Link className="underline" href="/portal/security">Security settings</Link>.</Alert></div>
      )}

      {app ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="card p-6 lg:col-span-2" aria-labelledby="status-h">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="status-h" className="text-xl font-semibold">Application status</h2>
                <p className="mt-1 text-sm text-muted">Application number</p>
                <p className="font-mono text-2xl font-bold text-olive-800">{app.applicationNo}</p>
              </div>
              <span className="badge bg-olive-700 px-3 py-1 text-sm text-white">{app.status === 'processing' ? 'Processing' : STATUS_LABELS[app.status]}</span>
            </div>
            <div className="mt-8"><StatusTimeline status={app.status} /></div>
            {app.status === 'rejected' && <div className="mt-6"><Alert tone="warning">Unfortunately your application was not successful in this exercise. You may apply in future exercises if you remain eligible.</Alert></div>}
          </section>
          <section className="card p-6" aria-labelledby="slip-h">
            <FileCheck2 aria-hidden className="h-8 w-8 text-olive-700" />
            <h2 id="slip-h" className="mt-3 text-xl font-semibold">Acknowledgement slip</h2>
            <p className="mt-1 text-sm text-muted">Print your slip and bring it to screening. It contains a QR code officers can scan to verify it.</p>
            <button onClick={downloadSlip} disabled={!app.slipReady} className="btn-primary mt-4 w-full"><Download aria-hidden className="h-4 w-4" />{app.slipReady ? 'Download PDF slip' : 'Generating slip…'}</button>
            {slipMsg && <p className="mt-2 text-sm text-muted">{slipMsg}</p>}
          </section>
          {app.screening && (
            <section className="card border-t-4 border-t-gold-500 p-6 lg:col-span-3" aria-labelledby="scr-h">
              <h2 id="scr-h" className="text-xl font-semibold">Screening schedule</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <p className="flex gap-2"><CalendarDays aria-hidden className="h-5 w-5 text-olive-600" /><span><span className="block text-xs text-muted">Date</span><strong>{new Date(app.screening.date).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' })}</strong></span></p>
                <p className="flex gap-2"><MapPin aria-hidden className="h-5 w-5 text-olive-600" /><span><span className="block text-xs text-muted">Venue</span><strong>{app.screening.centre}</strong><span className="block text-sm">{app.screening.address}</span></span></p>
                <p className="text-sm text-muted">Bring your printed slip, original credentials, birth and state-of-origin certificates, and sportswear.</p>
              </div>
            </section>
          )}
        </div>
      ) : draft?.exercise ? (
        <section className="card mt-8 p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{draft.exercise.title}</h2>
          <p className="mt-1 text-sm text-muted">Closing date: {new Date(draft.exercise.closesAt).toLocaleDateString('en-NG', { dateStyle: 'long' })}</p>
          <div className="mt-6">
            <div className="flex justify-between text-sm"><span>Your progress</span><span className="font-semibold">{progress}%</span></div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-olive-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Application progress"><div className="h-full bg-olive-700" style={{ width: `${progress}%` }} /></div>
          </div>
          {draft.exercise.open ? (
            <Link href="/portal/apply" className="btn-gold mt-6">{progress ? 'Continue application' : 'Start application'} <ArrowRight aria-hidden className="h-4 w-4" /></Link>
          ) : (
            <div className="mt-6"><Alert tone="warning">This exercise is closed for new applications.</Alert></div>
          )}
        </section>
      ) : (
        <div className="mt-8"><Alert tone="info" title="No recruitment exercise is open">Watch the website for announcements of the next exercise.</Alert></div>
      )}
    </div>
  );
}
