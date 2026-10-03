'use client';
/**
 * DEMO MODE: in-browser implementation of the API routes used by the portal and
 * admin console. Response shapes mirror apps/api so the UI code is unchanged.
 * Validation reuses the same shared Zod schemas and eligibility engine.
 */
import {
  APPLICATION_STEPS, DOCUMENT_RULES, DOCUMENT_TYPES, ENTRY_TYPE_LABELS, STATE_BY_CODE, STATUS_LABELS, STEP_SCHEMAS,
  checkEligibility, registerSchema, ageOn, type ApplicationStatus, type ApplicationStep, type DocumentType,
} from '@armyx/shared';
import { DEMO_ADMIN, DEMO_OTP, DEMO_TOTP, load, newApplicationNo, save, uid, type DemoApp, type DemoDoc } from './store';

export class DemoError extends Error {
  constructor(public status: number, message: string, public data: Record<string, any> = {}) {
    super(message);
  }
}
const fail = (status: number, message: string, data: Record<string, any> = {}) => {
  throw new DemoError(status, message, { message, ...data });
};

/** Files picked in the upload step, kept until "confirm" (photos are persisted for the slip). */
export const pendingUploads = new Map<string, { name: string; size: number; contentType: string; dataUrl?: string }>();

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ['under_review', 'shortlisted', 'rejected'],
  under_review: ['shortlisted', 'rejected'],
  shortlisted: ['under_review', 'rejected'],
  invited_for_screening: ['rejected'],
  rejected: ['under_review'],
};

const zodFields = (issues: { path: PropertyKey[]; message: string }[]) => {
  const f: Record<string, string> = {};
  for (const i of issues) f[i.path.map(String).join('.') || '_'] ??= i.message;
  return f;
};

function audit(action: string, entity_type?: string, entity_id?: string, details: any = {}) {
  const s = load();
  s.audit.unshift({ id: (s.audit[0]?.id ?? 0) + 1, actor_email: DEMO_ADMIN.email, actor_role: 'super_admin', action, entity_type, entity_id, details, ip: 'demo-browser', created_at: new Date().toISOString() });
}

function requireApplicant() {
  const s = load();
  const u = s.users.find((x) => x.id === s.sessionUserId);
  if (!u) fail(401, 'Please sign in to continue');
  return u!;
}
function requireAdmin() {
  if (!load().admin.loggedIn) fail(401, 'Please sign in to continue');
}

const exerciseOpen = () => {
  const e = load().exercise;
  const now = Date.now();
  return e.state === 'open' && now >= Date.parse(e.opensAt) && now <= Date.parse(e.closesAt);
};

function myApp(userId: string) {
  return load().apps.find((a) => a.userId === userId);
}

function draftOf(userId: string) {
  const s = load();
  return (s.drafts[userId] ??= { data: {}, stepsDone: [], updatedAt: new Date().toISOString() });
}

function eligibility(data: any) {
  const e = load().exercise;
  return checkEligibility(e.rules, data, new Date(e.closesAt));
}

function appStatusView(a: DemoApp) {
  const s = load();
  const c = a.screening ? s.centres.find((x) => x.id === a.screening!.centreId) : null;
  return {
    applicationNo: a.applicationNo, status: a.status, entryType: a.entryType, submittedAt: a.submittedAt, updatedAt: a.submittedAt,
    slipReady: a.slipReady || Date.now() > Date.parse(a.submittedAt) + 3000,
    screening: a.screening && c ? { date: a.screening.date, centre: c.name, address: c.address, state: c.state_code } : null,
    history: a.history.map((h) => ({ status: h.to, at: h.at })),
  };
}

function docsFor(a: DemoApp): DemoDoc[] {
  const own = load().docs[a.userId];
  if (own) return own;
  return DOCUMENT_TYPES.filter((t) => DOCUMENT_RULES[t].required).map((t) => ({ type: t, status: 'verified', size: 120_000, contentType: t === 'passport_photo' ? 'image/jpeg' : 'application/pdf', name: `${t}.pdf` }));
}

function applyStatus(ids: string[], to: ApplicationStatus, note?: string, screening?: { centreId: string; date: string }) {
  const s = load();
  let updated = 0;
  const allowedFrom = screening ? (['shortlisted', 'invited_for_screening'] as ApplicationStatus[]) : (Object.keys(TRANSITIONS) as ApplicationStatus[]).filter((k) => TRANSITIONS[k].includes(to));
  const candidates = s.apps.filter((a) => ids.includes(a.id) && allowedFrom.includes(a.status));
  if (to === 'shortlisted') {
    const byState = new Map<string, number>();
    for (const a of candidates) byState.set(a.state, (byState.get(a.state) ?? 0) + 1);
    for (const [state, adding] of byState) {
      const quota = s.exercise.quotas[state];
      const have = s.apps.filter((a) => a.state === state && (a.status === 'shortlisted' || a.status === 'invited_for_screening')).length;
      if (quota && have + adding > quota) fail(400, `Quota for ${STATE_BY_CODE[state]?.name ?? state} would be exceeded (${have} + ${adding} > ${quota})`);
    }
  }
  for (const a of candidates) {
    a.history.push({ from: a.status, to, at: new Date().toISOString(), actor: 'Demo Recruitment Officer', note: screening ? `Screening: ${s.centres.find((c) => c.id === screening.centreId)?.name}` : note });
    a.status = to;
    if (screening) a.screening = screening;
    updated++;
  }
  return { requested: ids.length, updated, skipped: ids.length - updated };
}

function csv(rows: DemoApp[]) {
  const esc = (v: unknown) => {
    let x = v === undefined || v === null ? '' : String(v);
    if (/^[=+\-@]/.test(x)) x = `'${x}`;
    return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
  };
  const head = ['Application No', 'Surname', 'First Name', 'Gender', 'Age', 'State', 'LGA', 'Qualification', 'Entry Type', 'Height (cm)', 'Status', 'Submitted At'];
  const lines = rows.map((a) => [a.applicationNo, a.surname, a.firstName, a.gender, a.age, STATE_BY_CODE[a.state]?.name, a.lga, a.qualification, ENTRY_TYPE_LABELS[a.entryType as keyof typeof ENTRY_TYPE_LABELS], a.heightCm, STATUS_LABELS[a.status], a.submittedAt].map(esc).join(','));
  return '﻿' + [head.join(','), ...lines].join('\n');
}

function filterApps(q: URLSearchParams) {
  const s = load();
  let rows = s.apps;
  const term = (q.get('q') ?? '').trim().toLowerCase();
  for (const [param, key] of [['state', 'state'], ['lga', 'lga'], ['qualification', 'qualification'], ['entryType', 'entryType'], ['status', 'status'], ['gender', 'gender']] as const) {
    const v = q.get(param);
    if (v) rows = rows.filter((a) => (a as any)[key] === v);
  }
  if (term) rows = rows.filter((a) => a.applicationNo.toLowerCase() === term || `${a.surname} ${a.firstName}`.toLowerCase().includes(term) || a.data?._contact?.email === term || a.data?._contact?.phone?.endsWith(term.replace(/^0/, '')));
  return rows;
}

const qrPlaceholder = (text: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff" stroke="#2f3b22" stroke-width="6"/><text x="100" y="92" font-family="Arial" font-size="15" text-anchor="middle" fill="#2f3b22">DEMO</text><text x="100" y="118" font-family="Arial" font-size="13" text-anchor="middle" fill="#2f3b22">${text}</text></svg>`);

export async function demoRequest(method: string, fullPath: string, body: any): Promise<any> {
  // Small artificial latency so loading states are visible, like a real network.
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
  const s = load();
  const url = new URL(fullPath, 'http://demo');
  const p = url.pathname;
  const q = url.searchParams;
  const m = (re: RegExp) => re.exec(p);
  let r: any;
  try {
    r = route();
  } finally {
    save();
  }
  return r;

  function route(): any {
    // ------------------------------------------------------------- public
    if (p === '/auth/csrf') return { token: 'demo' };
    if (p === '/reference/exercise') {
      const e = s.exercise;
      return { open: exerciseOpen(), code: e.code, title: e.title, opensAt: e.opensAt, closesAt: e.closesAt, rules: e.rules };
    }
    if (p === '/verify') {
      const a = s.apps.find((x) => x.applicationNo === (q.get('id') ?? '').toUpperCase());
      if (!a) fail(404, 'This slip could not be verified', { valid: false });
      return { valid: true, applicationNo: a!.applicationNo, name: `${a!.surname} ${a!.firstName.charAt(0)}.`, state: a!.state, exercise: s.exercise.title, status: STATUS_LABELS[a!.status] };
    }
    if (p === '/contact' && method === 'POST') return { received: true };

    // ------------------------------------------------------------- applicant auth
    if (p === '/auth/register' && method === 'POST') {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) fail(400, 'Validation failed', { fields: zodFields(parsed.error.issues) });
      const v = parsed.data!;
      if (s.users.some((u) => u.email === v.email || u.phone === v.phone)) fail(409, 'An account with this email address or phone number already exists. Try signing in.');
      const id = uid();
      s.users.push({ id, surname: v.surname.toUpperCase(), firstName: v.firstName, email: v.email, phone: v.phone, password: v.password, emailVerified: false, phoneVerified: false, twoFactor: false, createdAt: new Date().toISOString() });
      return { userId: id, verify: ['email', 'phone'] };
    }
    if (p === '/auth/otp/verify') {
      const u = s.users.find((x) => x.id === body.userId);
      if (!u) fail(400, 'Account not found');
      if (body.code !== DEMO_OTP) fail(400, `Incorrect code. In this demo the code is always ${DEMO_OTP}.`);
      if (body.channel === 'email') u!.emailVerified = true;
      else u!.phoneVerified = true;
      return { verified: body.channel, complete: u!.emailVerified && u!.phoneVerified };
    }
    if (p === '/auth/otp/resend') return { sent: true };
    if (p === '/auth/login') {
      const u = s.users.find((x) => x.email === String(body.email ?? '').trim().toLowerCase());
      if (!u || u.password !== body.password) fail(401, 'Incorrect email or password');
      const pending = [!u!.emailVerified && 'email', !u!.phoneVerified && 'phone'].filter(Boolean);
      if (pending.length) return { verificationRequired: true, userId: u!.id, verify: pending };
      if (u!.twoFactor) {
        if (!body.totp) return { mfaRequired: true };
        if (body.totp !== DEMO_TOTP) fail(401, `Invalid authentication code (demo code: ${DEMO_TOTP})`);
      }
      s.sessionUserId = u!.id;
      return { ok: true, user: { id: u!.id, surname: u!.surname, firstName: u!.firstName } };
    }
    if (p === '/auth/logout') {
      s.sessionUserId = null;
      return { ok: true };
    }
    if (p === '/auth/password/forgot' || p === '/auth/password/reset') return { ok: true };
    if (p === '/auth/me') {
      const u = requireApplicant();
      return { id: u.id, surname: u.surname, firstName: u.firstName, email: u.email, phone: u.phone, twoFactorEnabled: u.twoFactor, createdAt: u.createdAt };
    }
    if (p === '/auth/2fa/setup') {
      requireApplicant();
      return { secret: 'DEMODEMODEMODEMO', otpauthUrl: 'otpauth://totp/demo', qrDataUrl: qrPlaceholder(`code ${DEMO_TOTP}`) };
    }
    if (p === '/auth/2fa/enable' || p === '/auth/2fa/disable') {
      const u = requireApplicant();
      if (body.code !== DEMO_TOTP) fail(401, `Invalid authentication code (demo code: ${DEMO_TOTP})`);
      u.twoFactor = p.endsWith('enable');
      return { enabled: u.twoFactor };
    }

    // ------------------------------------------------------------- application
    if (p === '/applications/draft' && method === 'GET') {
      const u = requireApplicant();
      const d = draftOf(u.id);
      const e = s.exercise;
      return {
        exercise: { id: e.id, code: e.code, title: e.title, closesAt: e.closesAt, open: exerciseOpen(), rules: e.rules },
        submitted: !!myApp(u.id), ...d, documents: s.docs[u.id] ?? [], eligibility: eligibility(d.data),
      };
    }
    if (p === '/applications/draft' && method === 'PUT') {
      const u = requireApplicant();
      if (!exerciseOpen()) fail(403, 'Recruitment is not open at the moment');
      if (myApp(u.id)) fail(409, 'Application already submitted');
      const step = body.step as ApplicationStep;
      const parsed = STEP_SCHEMAS[step]?.safeParse(body.data);
      if (!parsed?.success) fail(400, 'Please correct the highlighted fields', { fields: parsed ? zodFields(parsed.error.issues) : {} });
      const d = draftOf(u.id);
      d.data[step] = parsed!.data;
      if (!d.stepsDone.includes(step)) d.stepsDone.push(step);
      d.updatedAt = new Date().toISOString();
      return { saved: true, stepsDone: d.stepsDone, updatedAt: d.updatedAt, eligibility: eligibility(d.data) };
    }
    if (p === '/applications/documents/presign') {
      requireApplicant();
      const rule = DOCUMENT_RULES[body.type as DocumentType];
      if (!rule) fail(400, 'Unknown document type');
      if (!rule.mimeTypes.includes(body.contentType)) fail(400, `${rule.label}: allowed types are ${rule.mimeTypes.join(', ')}`);
      if (body.size > rule.maxBytes) fail(400, `${rule.label} must not exceed ${Math.round(rule.maxBytes / 1024)}KB`);
      return { key: `demo/${body.type}/${uid()}`, url: 'demo://storage', fields: {} };
    }
    if (p === '/applications/documents/confirm') {
      const u = requireApplicant();
      const f = pendingUploads.get(body.key);
      if (!f) fail(400, 'Upload not found. Please upload the file again.');
      const list = (s.docs[u.id] ??= []).filter((d) => d.type !== body.type);
      list.push({ type: body.type, status: 'verified', size: f!.size, contentType: f!.contentType, name: f!.name, dataUrl: f!.dataUrl });
      s.docs[u.id] = list;
      pendingUploads.delete(body.key);
      return { id: uid(), type: body.type, status: 'verified', size: f!.size };
    }
    if (p === '/applications/submit') {
      const u = requireApplicant();
      if (!exerciseOpen()) fail(403, 'Recruitment is not open at the moment');
      if (myApp(u.id)) fail(409, 'You have already submitted an application for this exercise');
      const d = draftOf(u.id);
      const missing = APPLICATION_STEPS.filter((st) => !STEP_SCHEMAS[st].safeParse(d.data[st]).success);
      if (missing.length) fail(400, 'Please complete all sections before submitting', { missing });
      const docs = s.docs[u.id] ?? [];
      const missingDocs = DOCUMENT_TYPES.filter((t) => DOCUMENT_RULES[t].required && !docs.some((x) => x.type === t));
      if (missingDocs.length) fail(400, 'Please upload all required documents', { missingDocs });
      const el = eligibility(d.data);
      if (!el.eligible) fail(400, 'You do not meet the eligibility requirements', { reasons: el.reasons });
      const now = new Date().toISOString();
      const data = d.data as any;
      const a: DemoApp = {
        id: uid(), applicationNo: newApplicationNo(), userId: u.id, status: 'submitted', entryType: data.entry.entryType, trade: data.entry.trade,
        surname: data.personal.surname.toUpperCase(), firstName: data.personal.firstName, gender: data.personal.gender,
        age: ageOn(data.personal.dateOfBirth, new Date(s.exercise.closesAt)), state: data.origin.stateOfOrigin, lga: data.origin.lga,
        qualification: data.education.highestQualification, heightCm: data.physical.heightCm, submittedAt: now, slipReady: false,
        data: { ...data, _contact: { email: u.email, phone: u.phone } }, screening: null,
        history: [{ from: null, to: 'submitted', at: now, note: 'Online submission' }],
      };
      s.apps.unshift(a);
      delete s.drafts[u.id];
      return { applicationNo: a.applicationNo, status: 'processing', submittedAt: now };
    }
    if (p === '/applications/me') {
      const u = requireApplicant();
      const a = myApp(u.id);
      return { application: a ? appStatusView(a) : null };
    }
    if (p === '/applications/me/slip') {
      const u = requireApplicant();
      if (!myApp(u.id)) fail(404, 'No submitted application');
      return { url: '/portal/slip' };
    }

    // ------------------------------------------------------------- admin auth
    if (p === '/admin/auth/login') {
      if (String(body.email ?? '').toLowerCase() !== DEMO_ADMIN.email || body.password !== DEMO_ADMIN.password) fail(401, 'Incorrect email or password');
      if (!body.totp) return { mfaRequired: true };
      if (body.totp !== DEMO_TOTP) fail(401, `Invalid authentication code (demo code: ${DEMO_TOTP})`);
      s.admin.loggedIn = true;
      s.admins[0]!.last_login_at = new Date().toISOString();
      audit('admin.login');
      return { ok: true, admin: { id: 'adm-1', email: DEMO_ADMIN.email, role: 'super_admin' } };
    }
    if (p === '/admin/auth/me') {
      requireAdmin();
      return { id: 'adm-1', email: DEMO_ADMIN.email, role: 'super_admin' };
    }
    if (p === '/admin/auth/logout') {
      s.admin.loggedIn = false;
      return { ok: true };
    }
    if (p === '/admin/auth/accept-invite') return { ok: true };
    if (p.startsWith('/admin/auth/mfa')) fail(400, 'Not needed in the demo: the demo officer already has 2FA set up.');

    // ------------------------------------------------------------- admin
    if (p.startsWith('/admin/')) requireAdmin();

    if (p === '/admin/dashboard') {
      const count = (k: (a: DemoApp) => string) => s.apps.reduce<Record<string, number>>((acc, a) => ((acc[k(a)] = (acc[k(a)] ?? 0) + 1), acc), {});
      const daily = count((a) => a.submittedAt.slice(0, 10));
      return {
        total: s.apps.length, lastHour: s.apps.filter((a) => Date.now() - Date.parse(a.submittedAt) < 3600000).length, pendingSubmissions: 0,
        byState: count((a) => a.state), byStatus: { submitted: 0, under_review: 0, shortlisted: 0, invited_for_screening: 0, rejected: 0, ...count((a) => a.status) },
        byEntryType: count((a) => a.entryType), daily: Object.entries(daily).sort(([x], [y]) => x.localeCompare(y)).map(([date, c]) => ({ date, count: c })),
        generatedAt: new Date().toISOString(),
      };
    }
    if (p === '/admin/applicants' && method === 'GET') {
      const rows = [...filterApps(q)];
      const sort = q.get('sort') ?? 'submitted_at';
      const dir = q.get('order') === 'asc' ? 1 : -1;
      const key: Record<string, (a: DemoApp) => string | number> = {
        submitted_at: (a) => a.submittedAt, surname: (a) => a.surname, state: (a) => a.state, status: (a) => a.status, height_cm: (a) => a.heightCm,
      };
      const k = key[sort] ?? key.submitted_at!;
      rows.sort((a, b) => (k(a) > k(b) ? dir : k(a) < k(b) ? -dir : 0));
      const limit = Number(q.get('limit') ?? 50);
      const offset = Number(q.get('cursor') ?? 0);
      const page = rows.slice(offset, offset + limit);
      return {
        total: rows.length, nextCursor: offset + limit < rows.length ? String(offset + limit) : null,
        items: page.map((a) => ({
          id: a.id, applicationNo: a.applicationNo, surname: a.surname, firstName: a.firstName, gender: a.gender, age: a.age, state: a.state, lga: a.lga,
          qualification: a.qualification, entryType: a.entryType, trade: a.trade, heightCm: a.heightCm, status: a.status, submittedAt: a.submittedAt, screeningDate: a.screening?.date ?? null,
        })),
      };
    }
    let mm = m(/^\/admin\/applicants\/([^/]+)\/documents\/([a-z_]+)$/);
    if (mm) {
      const a = s.apps.find((x) => x.id === mm![1]);
      if (!a) fail(404, 'Document not found');
      const d = docsFor(a!).find((x) => x.type === mm![2]);
      audit('applicant.document_view', 'application', a!.id, { type: mm![2] });
      return { url: d?.dataUrl ?? (mm![2] === 'passport_photo' ? qrPlaceholder('passport photo') : '/downloads/sample.pdf') };
    }
    mm = m(/^\/admin\/applicants\/([0-9a-z-]+)$/);
    if (mm && method === 'GET') {
      const a = s.apps.find((x) => x.id === mm![1]);
      if (!a) fail(404, 'Application not found');
      const c = a!.screening ? s.centres.find((x) => x.id === a!.screening!.centreId) : null;
      audit('applicant.view', 'application', a!.id);
      const { _contact, ...data } = a!.data;
      return {
        id: a!.id, applicationNo: a!.applicationNo, status: a!.status, submittedAt: a!.submittedAt, reviewNote: null,
        screening: a!.screening && c ? { date: a!.screening.date, centre: c.name, address: c.address } : null,
        contact: _contact ?? {}, data,
        documents: docsFor(a!).map((d) => ({ id: d.type, type: d.type, contentType: d.contentType, size: d.size, status: d.status })),
        history: a!.history.map((h) => ({ from_status: h.from, to_status: h.to, note: h.note, created_at: h.at, actor: h.actor })),
      };
    }
    if (p === '/admin/applicants/bulk/status') {
      const res = applyStatus(body.ids, body.status, body.note);
      audit(`applicant.bulk_${body.status}`, 'application', undefined, { ...res, note: body.note });
      return res;
    }
    if (p === '/admin/applicants/bulk/screening') {
      if (!s.centres.some((c) => c.id === body.centreId)) fail(404, 'Screening centre not found');
      const res = applyStatus(body.ids, 'invited_for_screening', undefined, { centreId: body.centreId, date: body.screeningDate });
      audit('applicant.bulk_screening', 'screening_centre', body.centreId, { ...res, date: body.screeningDate });
      return res;
    }
    if (p === '/admin/exercises' && method === 'GET') {
      const e = s.exercise;
      return [{ id: e.id, code: e.code, title: e.title, state: e.state, opens_at: e.opensAt, closes_at: e.closesAt, rules: e.rules, quotas: e.quotas, created_at: e.createdAt, applications: s.apps.length }];
    }
    if (p === '/admin/exercises' && method === 'POST') fail(400, 'The demo has a single exercise. Edit it instead, or reset the demo.');
    mm = m(/^\/admin\/exercises\/([^/]+)\/(open|close)$/);
    if (mm) {
      s.exercise.state = mm[2] === 'open' ? 'open' : 'closed';
      audit(`exercise.${mm[2]}`, 'exercise', s.exercise.id);
      return { id: s.exercise.id, code: s.exercise.code, state: s.exercise.state };
    }
    mm = m(/^\/admin\/exercises\/centres\/([^/]+)$/);
    if (mm && method === 'DELETE') {
      if (s.apps.some((a) => a.screening?.centreId === mm![1])) fail(409, 'Centre has assigned applicants and cannot be deleted');
      s.centres = s.centres.filter((c) => c.id !== mm![1]);
      audit('centre.delete', 'screening_centre', mm[1]);
      return { ok: true };
    }
    mm = m(/^\/admin\/exercises\/([^/]+)\/centres$/);
    if (mm && method === 'GET') return s.centres.map((c) => ({ ...c, assigned: s.apps.filter((a) => a.screening?.centreId === c.id).length }));
    if (mm && method === 'POST') {
      const c = { id: uid(), exercise_id: s.exercise.id, name: body.name, state_code: body.stateCode, address: body.address, capacity_per_day: body.capacityPerDay, created_at: new Date().toISOString() };
      s.centres.push(c);
      audit('centre.create', 'screening_centre', c.id, body);
      return c;
    }
    mm = m(/^\/admin\/exercises\/([^/]+)$/);
    if (mm && method === 'PUT') {
      for (const r of Object.values(body.rules ?? {}) as any[]) if (r.minAge > r.maxAge) fail(400, 'Minimum age cannot exceed maximum age');
      Object.assign(s.exercise, { code: body.code, title: body.title, opensAt: body.opensAt, closesAt: body.closesAt, rules: body.rules, quotas: body.quotas });
      audit('exercise.update', 'exercise', s.exercise.id, { rules: body.rules });
      return s.exercise;
    }
    if (p === '/admin/exports' && method === 'POST') {
      const f = new URLSearchParams(Object.entries(body.filter ?? {}).filter(([, v]) => v) as [string, string][]);
      const e = { id: uid(), format: body.format, status: 'done', row_count: filterApps(f).length, created_at: new Date().toISOString(), completed_at: new Date().toISOString(), filter: body.filter };
      s.exports.unshift(e);
      audit('export.create', 'export', e.id, { format: body.format, filter: body.filter });
      return e;
    }
    if (p === '/admin/exports' && method === 'GET') return s.exports;
    mm = m(/^\/admin\/exports\/([^/]+)\/download$/);
    if (mm) {
      const e = s.exports.find((x) => x.id === mm![1]);
      if (!e) fail(404, 'Export not ready');
      audit('export.download', 'export', e!.id);
      // The demo always produces CSV (opens in Excel); the real workers also produce .xlsx.
      const blob = new Blob([csv(filterApps(new URLSearchParams(Object.entries(e!.filter ?? {}).filter(([, v]) => v) as [string, string][])))], { type: 'text/csv' });
      return { url: URL.createObjectURL(blob) };
    }
    if (p === '/admin/audit-logs') {
      let rows = s.audit;
      if (q.get('actor')) rows = rows.filter((r) => r.actor_email.includes(q.get('actor')!));
      if (q.get('action')) rows = rows.filter((r) => r.action.startsWith(q.get('action')!));
      if (q.get('before')) rows = rows.filter((r) => r.id < Number(q.get('before')));
      return rows.slice(0, Number(q.get('limit') ?? 50));
    }
    if (p === '/admin/users' && method === 'GET') return s.admins;
    if (p === '/admin/users' && method === 'POST') {
      if (s.admins.some((a) => a.email === body.email)) fail(409, 'This record already exists');
      const a = { id: uid(), email: body.email, full_name: body.fullName, role: body.role, active: true, totp_enabled: false, last_login_at: null, created_at: new Date().toISOString() };
      s.admins.push(a);
      audit('admin_user.invite', 'admin_user', a.id, { email: body.email, role: body.role });
      return a;
    }
    mm = m(/^\/admin\/users\/([^/]+)$/);
    if (mm && method === 'PATCH') {
      const a = s.admins.find((x) => x.id === mm![1]);
      if (!a) fail(404, 'Not found');
      if (a!.id === 'adm-1' && (body.active === false || (body.role && body.role !== 'super_admin'))) fail(400, 'You cannot demote or deactivate your own account');
      Object.assign(a!, body);
      audit('admin_user.update', 'admin_user', a!.id, body);
      return a;
    }
    fail(404, `Not available in demo: ${method} ${p}`);
  }
}
