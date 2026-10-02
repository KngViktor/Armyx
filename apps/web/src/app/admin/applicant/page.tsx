'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { DOCUMENT_RULES, ENTRY_TYPE_LABELS, QUALIFICATION_LABELS, STATE_BY_CODE, STATUS_LABELS, type ApplicationStatus } from '@armyx/shared';
import { api } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { Alert } from '@/components/ui/Alert';

function Detail() {
  const id = useSearchParams().get('id') ?? '';
  const [a, setA] = useState<any>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const load = useCallback(() => api(`/admin/applicants/${id}`).then(setA).catch((e) => setMsg({ tone: 'error', text: e.message })), [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const view = async (type: string) => {
    const r = await api(`/admin/applicants/${id}/documents/${type}`);
    window.open(r.url, '_blank', 'noopener');
  };
  const setStatus = async (status: string) => {
    try {
      const r = await api('/admin/applicants/bulk/status', { body: { ids: [id], status, note: note || undefined } });
      setMsg(r.updated ? { tone: 'success', text: `Status changed to ${STATUS_LABELS[status as ApplicationStatus]}.` } : { tone: 'error', text: 'This change is not allowed from the current status.' });
      load();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  };

  if (!a) return <p className="text-muted">{msg?.text ?? 'Loading…'}</p>;
  const d = a.data;
  const Section = ({ title, rows }: { title: string; rows: [string, any][] }) => (
    <section className="card p-5">
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium">{v === true ? 'Yes' : v === false ? 'No' : v || '—'}</dd></div>)}</dl>
    </section>
  );
  return (
    <div className="space-y-5">
      <Link href="/admin/applicants" className="inline-flex items-center gap-1 text-sm text-olive-700 underline"><ArrowLeft aria-hidden className="h-4 w-4" />Applicants</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold">{d.personal.surname} {d.personal.firstName}</h1><p className="font-mono text-sm text-muted">{a.applicationNo}</p></div>
        <span className="badge bg-olive-700 px-3 py-1 text-sm text-white">{STATUS_LABELS[a.status as ApplicationStatus]}</span>
      </div>
      <Alert tone="info">Access to this record has been recorded in the audit log.</Alert>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="Personal" rows={[['Gender', d.personal.gender], ['Date of birth', d.personal.dateOfBirth], ['Marital status', d.personal.maritalStatus], ['NIN', d.personal.nin], ['Email', a.contact.email], ['Phone', a.contact.phone], ['Address', d.personal.residentialAddress], ['State of residence', STATE_BY_CODE[d.personal.stateOfResidence]?.name]]} />
          <Section title="Origin" rows={[['State', STATE_BY_CODE[d.origin.stateOfOrigin]?.name], ['LGA', d.origin.lga], ['Hometown', d.origin.hometown]]} />
          <Section title="Education" rows={[['Highest qualification', QUALIFICATION_LABELS[d.education.highestQualification as keyof typeof QUALIFICATION_LABELS]], ['O-Level credits', d.education.olevelCredits], ['Sittings', d.education.olevelSittings], ['English & Maths', d.education.hasEnglishAndMaths], ['Institutions', d.education.institutions.map((i: any) => `${i.name} (${i.yearCompleted})`).join('; ')]]} />
          <Section title="Physical" rows={[['Height', `${(d.physical.heightCm / 100).toFixed(2)} m`], ['Weight', `${d.physical.weightKg} kg`], ['Genotype', d.physical.genotype], ['Blood group', d.physical.bloodGroup], ['Disability', d.physical.hasDisability], ['Criminal record', d.physical.hasCriminalRecord]]} />
          <Section title="Next of kin & entry" rows={[['Next of kin', `${d.next_of_kin.fullName} (${d.next_of_kin.relationship})`], ['NOK phone', d.next_of_kin.phone], ['Entry type', ENTRY_TYPE_LABELS[d.entry.entryType as keyof typeof ENTRY_TYPE_LABELS]], ['Trade', d.entry.trade], ['Preferred screening state', STATE_BY_CODE[d.entry.preferredScreeningState]?.name]]} />
        </div>
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="font-sans text-base font-semibold">Documents</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {a.documents.map((doc: any) => (
                <li key={doc.id} className="flex items-center justify-between gap-2">
                  <span>{DOCUMENT_RULES[doc.type as keyof typeof DOCUMENT_RULES]?.label}<span className={`ml-2 badge ${doc.status === 'verified' ? 'bg-green-100 text-success' : doc.status === 'rejected' ? 'bg-red-100 text-danger' : 'bg-khaki-100'}`}>{doc.status}</span></span>
                  <button className="btn-outline min-h-8 px-2 py-1" onClick={() => view(doc.type)}><Eye aria-hidden className="h-4 w-4" /><span className="sr-only">View {doc.type}</span></button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Links are signed and expire after 2 minutes.</p>
          </section>
          <section className="card space-y-3 p-5">
            <h2 className="font-sans text-base font-semibold">Decision</h2>
            <label className="block text-sm"><span className="mb-1 block font-semibold">Note (optional)</span><textarea className="field-input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline" onClick={() => setStatus('under_review')}>Under review</button>
              <button className="btn-gold" onClick={() => setStatus('shortlisted')}>Shortlist</button>
              <button className="btn bg-danger text-white" onClick={() => confirm('Reject this applicant?') && setStatus('rejected')}>Reject</button>
            </div>
            {a.screening && <p className="text-sm">Screening: <strong>{a.screening.centre}</strong>, {new Date(a.screening.date).toLocaleString('en-NG')}</p>}
          </section>
          <section className="card p-5">
            <h2 className="font-sans text-base font-semibold">History</h2>
            <ol className="mt-3 space-y-2 border-l-2 border-olive-100 pl-4 text-sm">
              {a.history.map((h: any, i: number) => <li key={i}><strong>{STATUS_LABELS[h.to_status as ApplicationStatus]}</strong><span className="block text-xs text-muted">{new Date(h.created_at).toLocaleString('en-NG')}{h.actor ? ` · ${h.actor}` : ''}</span>{h.note && <span className="block text-xs">{h.note}</span>}</li>)}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ApplicantPage() {
  return <AdminShell><Suspense><Detail /></Suspense></AdminShell>;
}
