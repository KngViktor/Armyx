'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CloudUpload, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import {
  APPLICATION_STEPS, DOCUMENT_RULES, DOCUMENT_TYPES, ENTRY_TYPE_LABELS, QUALIFICATION_LABELS, QUALIFICATIONS, STATE_BY_CODE, STEP_SCHEMAS,
  type ApplicationStep,
} from '@armyx/shared';
import { api, ApiError } from '@/lib/api';
import { useApplicant } from './usePortal';
import { STEPS, coerce } from './steps';
import { StepForm } from './StepForm';
import { Documents, type DocInfo } from './Documents';
import { Alert } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Field';
import { Turnstile } from '@/components/ui/Turnstile';

type WizardStep = ApplicationStep | 'documents' | 'review';
const ORDER: WizardStep[] = [...APPLICATION_STEPS, 'documents', 'review'];
const TITLES: Record<WizardStep, string> = { ...Object.fromEntries(STEPS.map((s) => [s.id, s.title])), documents: 'Documents', review: 'Review & submit' } as Record<WizardStep, string>;

interface Draft {
  exercise: { title: string; closesAt: string; open: boolean } | null;
  submitted: boolean;
  data: Record<string, Record<string, any>>;
  stepsDone: ApplicationStep[];
  documents: DocInfo[];
  eligibility: { eligible: boolean; reasons: string[] };
  updatedAt?: string;
}

export function ApplicationWizard() {
  const { me } = useApplicant();
  const router = useRouter();
  const sp = useSearchParams();
  const step = (ORDER.includes(sp.get('step') as WizardStep) ? sp.get('step') : 'personal') as WizardStep;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [banner, setBanner] = useState<string>('');
  const [declaration, setDeclaration] = useState(false);
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ applicationNo: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    const d = await api<Draft>('/applications/draft');
    setDraft(d);
    return d;
  }, []);

  useEffect(() => {
    if (me) load().then((d) => d.submitted && router.replace('/portal'));
  }, [me, load, router]);

  // Initialise form values when the step changes (pre-filling from draft / account).
  useEffect(() => {
    if (!draft || !me) return;
    const existing = (draft.data[step] ?? {}) as Record<string, any>;
    const defaults: Record<string, any> =
      step === 'personal' ? { surname: me.surname, firstName: me.firstName } :
      step === 'education' ? { institutions: [{ name: '', qualification: 'ssce', yearCompleted: '' }], olevelSittings: '1' } :
      step === 'entry' ? { preferredScreeningState: draft.data.personal?.stateOfResidence ?? '' } : {};
    const v = { ...defaults, ...existing };
    if (step === 'education' && v.olevelSittings !== undefined) v.olevelSittings = String(v.olevelSittings);
    setValues(v);
    setErrors({});
    setBanner('');
    dirty.current = false;
    headingRef.current?.focus();
  }, [step, draft?.updatedAt, !!draft, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s: WizardStep) => router.push(`/portal/apply?step=${s}`, { scroll: true });
  const idx = ORDER.indexOf(step);
  const formStep = STEPS.find((s) => s.id === step);

  /** Validates locally with the shared schema, then saves to the API (which validates again). */
  const save = useCallback(async (opts: { silent?: boolean } = {}): Promise<boolean> => {
    if (!formStep) return true;
    const data = coerce(formStep.id, values);
    const parsed = STEP_SCHEMAS[formStep.id].safeParse(data);
    if (!parsed.success) {
      if (opts.silent) return false;
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[i.path.join('.')] ??= i.message;
      setErrors(f);
      setBanner('Please correct the highlighted fields.');
      return false;
    }
    setSaveState('saving');
    try {
      const r = await api<{ stepsDone: ApplicationStep[]; eligibility: Draft['eligibility']; updatedAt: string }>('/applications/draft', { method: 'PUT', body: { step: formStep.id, data: parsed.data } });
      setDraft((d) => d && { ...d, data: { ...d.data, [formStep.id]: parsed.data }, stepsDone: r.stepsDone, eligibility: r.eligibility });
      setSaveState('saved');
      dirty.current = false;
      return true;
    } catch (e) {
      setSaveState('error');
      if (!opts.silent) {
        setBanner((e as Error).message);
        if (e instanceof ApiError) setErrors(e.fields);
      }
      return false;
    }
  }, [formStep, values]);

  // Autosave: 3s after the last change, if the step is valid.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => save({ silent: true }), 3000);
    return () => clearTimeout(t);
  }, [values, save]);

  const change = (name: string, value: any) => {
    dirty.current = true;
    setSaveState('idle');
    setValues((v) => ({ ...v, [name]: value, ...(name === 'stateOfOrigin' ? { lga: '' } : {}) }));
  };

  async function next() {
    if (await save()) go(ORDER[idx + 1]!);
  }

  async function submit() {
    setSubmitting(true);
    setBanner('');
    try {
      const r = await api<{ applicationNo: string }>('/applications/submit', { body: { declaration: true, captchaToken: token || undefined } });
      setResult(r);
      window.scrollTo({ top: 0 });
    } catch (e) {
      const d = e instanceof ApiError ? e.data : {};
      setBanner([(e as Error).message, ...(d.reasons ?? []), ...(d.missing ?? []).map((m: string) => `Incomplete: ${TITLES[m as WizardStep]}`), ...(d.missingDocs ?? []).map((m: string) => `Missing document: ${DOCUMENT_RULES[m as keyof typeof DOCUMENT_RULES].label}`)].join(' • '));
    } finally {
      setSubmitting(false);
    }
  }

  const missingDocs = useMemo(() => DOCUMENT_TYPES.filter((t) => DOCUMENT_RULES[t].required && !draft?.documents.some((d) => d.type === t && d.status !== 'rejected')), [draft]);

  if (!draft || !me) return <div className="container-x py-16 text-muted" aria-live="polite">Loading your application…</div>;
  if (!draft.exercise?.open) return <div className="container-x py-16"><Alert tone="warning" title="Applications are closed">There is no open recruitment exercise.</Alert></div>;

  if (result)
    return (
      <div className="container-x max-w-2xl py-16 text-center">
        <CheckCircle2 aria-hidden className="mx-auto h-16 w-16 text-success" />
        <h1 className="mt-4 text-3xl font-bold">Application submitted</h1>
        <p className="mt-2 text-muted">Your application number is</p>
        <p className="mt-2 font-mono text-3xl font-bold text-olive-800">{result.applicationNo}</p>
        <p className="mt-4 text-sm">Write it down. Your acknowledgement slip will be ready on your dashboard in a moment, and we have sent you an email and SMS.</p>
        <Link href="/portal" className="btn-primary mt-8">Go to dashboard</Link>
      </div>
    );

  return (
    <div className="container-x grid gap-8 py-10 lg:grid-cols-12">
      {/* Step navigation */}
      <aside className="lg:col-span-3">
        <nav aria-label="Application sections" className="card p-4 lg:sticky lg:top-28">
          <p className="px-2 text-xs font-semibold tracking-widest text-muted uppercase">{draft.exercise.title}</p>
          <ol className="mt-3 space-y-1">
            {ORDER.map((s, i) => {
              const done = (APPLICATION_STEPS as readonly string[]).includes(s) ? draft.stepsDone.includes(s as ApplicationStep) : s === 'documents' ? missingDocs.length === 0 : false;
              return (
                <li key={s}>
                  <button type="button" onClick={() => go(s)} aria-current={s === step ? 'step' : undefined}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm ${s === step ? 'bg-olive-700 font-semibold text-white' : 'hover:bg-olive-50'}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${done ? 'bg-success text-white' : s === step ? 'bg-gold-500 text-olive-950' : 'bg-olive-100 text-olive-900'}`}>
                      {done ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    {TITLES[s]}{done && <span className="sr-only"> (complete)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={`mt-4 rounded-md p-3 text-sm ${draft.eligibility.eligible ? 'bg-green-50 text-success' : 'bg-khaki-100 text-olive-950'}`} aria-live="polite">
            <p className="flex items-center gap-2 font-semibold">{draft.eligibility.eligible ? <ShieldCheck aria-hidden className="h-4 w-4" /> : <ShieldAlert aria-hidden className="h-4 w-4" />}Eligibility pre-check</p>
            {draft.eligibility.eligible ? <p className="mt-1">You meet the requirements so far.</p> : <ul className="mt-1 list-disc pl-5">{draft.eligibility.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          </div>
        </nav>
      </aside>

      {/* Step body */}
      <section className="card p-6 sm:p-8 lg:col-span-9" aria-labelledby="step-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-olive-100 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-widest text-olive-600 uppercase">Section {idx + 1} of {ORDER.length}</p>
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold outline-none sm:text-3xl">{TITLES[step]}</h1>
            {formStep && <p className="mt-1 text-sm text-muted">{formStep.description}</p>}
          </div>
          {formStep && (
            <p className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
              <CloudUpload aria-hidden className="h-4 w-4" />
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Not saved — check fields' : 'Saved automatically'}
            </p>
          )}
        </div>

        <div className="mt-6 space-y-6">
          {banner && <Alert tone="error">{banner}</Alert>}

          {formStep && <StepForm fields={formStep.fields} values={values} errors={errors} onChange={change} />}

          {step === 'education' && (
            <fieldset>
              <legend className="field-label">Schools / institutions attended</legend>
              <ul className="space-y-3">
                {(values.institutions ?? []).map((inst: any, i: number) => {
                  const upd = (k: string, val: string) => change('institutions', values.institutions.map((x: any, j: number) => (j === i ? { ...x, [k]: val } : x)));
                  return (
                    <li key={i} className="grid gap-3 rounded-lg border border-olive-100 p-3 sm:grid-cols-12">
                      <label className="sm:col-span-6"><span className="sr-only">Institution name {i + 1}</span><input className="field-input" placeholder="Institution name" value={inst.name} onChange={(e) => upd('name', e.target.value)} aria-invalid={!!errors[`institutions.${i}.name`]} /></label>
                      <label className="sm:col-span-3"><span className="sr-only">Qualification</span>
                        <select className="field-input" value={inst.qualification} onChange={(e) => upd('qualification', e.target.value)}>{QUALIFICATIONS.map((q) => <option key={q} value={q}>{QUALIFICATION_LABELS[q].split(' (')[0]}</option>)}</select>
                      </label>
                      <label className="sm:col-span-2"><span className="sr-only">Year completed</span><input className="field-input" inputMode="numeric" placeholder="Year" value={inst.yearCompleted} onChange={(e) => upd('yearCompleted', e.target.value)} aria-invalid={!!errors[`institutions.${i}.yearCompleted`]} /></label>
                      <button type="button" className="btn-outline px-3 sm:col-span-1" aria-label={`Remove institution ${i + 1}`} disabled={values.institutions.length === 1} onClick={() => change('institutions', values.institutions.filter((_: any, j: number) => j !== i))}><Trash2 aria-hidden className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
              {(values.institutions?.length ?? 0) < 6 && <button type="button" className="btn-outline mt-3" onClick={() => change('institutions', [...(values.institutions ?? []), { name: '', qualification: 'ssce', yearCompleted: '' }])}><Plus aria-hidden className="h-4 w-4" />Add institution</button>}
              {errors.institutions && <p className="mt-1 text-sm text-danger">{errors.institutions}</p>}
            </fieldset>
          )}

          {step === 'documents' && <Documents docs={draft.documents} onChange={load} />}

          {step === 'review' && <Review draft={draft} go={go} />}

          {step === 'review' && (
            <div className="space-y-4 rounded-lg border-2 border-gold-500 bg-khaki-100/50 p-5">
              <Checkbox checked={declaration} onChange={(e) => setDeclaration(e.target.checked)}
                label="I declare that the information I have given is true and complete. I understand that any false declaration will lead to my disqualification at any stage, even after enlistment." />
              <Turnstile onToken={setToken} />
              <button type="button" onClick={submit} className="btn-gold w-full sm:w-auto"
                disabled={!declaration || submitting || !draft.eligibility.eligible || draft.stepsDone.length < APPLICATION_STEPS.length || missingDocs.length > 0}>
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
              {!draft.eligibility.eligible && <p className="text-sm text-danger">You cannot submit because you do not meet the eligibility requirements.</p>}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-olive-100 pt-6">
          {idx > 0 ? <button type="button" className="btn-outline" onClick={async () => { if (formStep && dirty.current) await save({ silent: true }); go(ORDER[idx - 1]!); }}><ArrowLeft aria-hidden className="h-4 w-4" />Back</button> : <span />}
          {step !== 'review' && (
            step === 'documents'
              ? <button type="button" className="btn-primary" onClick={() => go('review')}>Continue to review <ArrowRight aria-hidden className="h-4 w-4" /></button>
              : <button type="button" className="btn-primary" onClick={next} disabled={saveState === 'saving'}>Save & continue <ArrowRight aria-hidden className="h-4 w-4" /></button>
          )}
        </div>
      </section>
    </div>
  );
}

function Review({ draft, go }: { draft: Draft; go: (s: WizardStep) => void }) {
  const fmt = (step: ApplicationStep, name: string, v: any): string => {
    if (v === undefined || v === '' || v === null) return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (name.toLowerCase().includes('state')) return STATE_BY_CODE[v]?.name ?? v;
    if (name === 'entryType') return ENTRY_TYPE_LABELS[v as keyof typeof ENTRY_TYPE_LABELS];
    if (name === 'highestQualification') return QUALIFICATION_LABELS[v as keyof typeof QUALIFICATION_LABELS];
    if (name === 'heightCm') return `${(Number(v) / 100).toFixed(2)} m`;
    return String(v);
  };
  return (
    <div className="space-y-5">
      {STEPS.map((s) => {
        const d = draft.data[s.id];
        return (
          <section key={s.id} className="rounded-lg border border-olive-100" aria-labelledby={`rv-${s.id}`}>
            <div className="flex items-center justify-between border-b border-olive-100 bg-olive-50 px-4 py-2">
              <h2 id={`rv-${s.id}`} className="font-sans text-base font-semibold">{s.title}</h2>
              <button type="button" onClick={() => go(s.id)} className="text-sm font-semibold text-olive-700 underline">Edit<span className="sr-only"> {s.title}</span></button>
            </div>
            {d ? (
              <dl className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
                {s.fields.filter((f) => !f.show || f.show(d)).map((f) => (
                  <div key={f.name} className="flex justify-between gap-3 border-b border-dashed border-olive-100 py-1 sm:block sm:border-0">
                    <dt className="text-muted">{f.label}</dt><dd className="font-medium">{fmt(s.id, f.name, d[f.name])}</dd>
                  </div>
                ))}
                {s.id === 'education' && <div className="sm:col-span-2"><dt className="text-muted">Institutions</dt><dd className="font-medium">{(d.institutions ?? []).map((i: any) => `${i.name} (${i.yearCompleted})`).join('; ')}</dd></div>}
              </dl>
            ) : (
              <p className="p-4 text-sm text-danger">Not completed yet.</p>
            )}
          </section>
        );
      })}
      <section className="rounded-lg border border-olive-100 p-4">
        <h2 className="font-sans text-base font-semibold">Documents</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {DOCUMENT_TYPES.map((t) => {
            const d = draft.documents.find((x) => x.type === t);
            return <li key={t} className="flex justify-between gap-3"><span>{DOCUMENT_RULES[t].label}</span><span className={d ? (d.status === 'rejected' ? 'text-danger' : 'text-success') : DOCUMENT_RULES[t].required ? 'text-danger' : 'text-muted'}>{d ? (d.status === 'rejected' ? 'Rejected' : 'Uploaded') : DOCUMENT_RULES[t].required ? 'Missing' : 'Optional'}</span></li>;
          })}
        </ul>
      </section>
    </div>
  );
}
