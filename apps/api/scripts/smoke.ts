/**
 * End-to-end smoke test against a running stack (API + workers + Postgres +
 * Redis + S3). Exercises the full applicant journey and the admin workflow:
 *
 *   register -> OTP verify -> login -> 6 form steps -> direct-to-S3 uploads ->
 *   submit (202) -> worker persists + PDF slip -> admin login with 2FA ->
 *   dashboard/search -> bulk shortlist -> bulk screening -> export -> audit log
 *
 * Requires OTP_FIXED_CODE to be set on the API (staging/dev only).
 *   API_URL=http://localhost:4000 OTP_FIXED_CODE=123456 pnpm tsx scripts/smoke.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { totpAt } from '../src/common/totp';

const API = (process.env.API_URL ?? 'http://localhost:4000') + '/api/v1';
const OTP = process.env.OTP_FIXED_CODE ?? '123456';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'superadmin@army.mil.ng';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Army2026';
const TOTP_FILE = process.env.SMOKE_TOTP_FILE ?? join(tmpdir(), 'armyx-smoke-admin-totp');

class Client {
  jar = new Map<string, string>();
  async req(method: string, path: string, body?: unknown, expect = [200, 201, 202]) {
    const headers: Record<string, string> = { Origin: ORIGIN, Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.jar.has('csrf')) headers['X-CSRF-Token'] = this.jar.get('csrf')!;
    const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, v] = kv!.split('=');
      if (v) this.jar.set(k!, v);
      else this.jar.delete(k!);
    }
    const json = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    if (!expect.includes(res.status)) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
    return json as any;
  }
}

const step = (msg: string) => console.log(`✓ ${msg}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Minimal valid JPEG and PDF payloads (magic bytes are what the worker checks).
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

async function main() {
  const year = new Date().getFullYear();
  const n = Date.now() % 1e8;
  const email = `smoke+${n}@example.ng`;
  const phone = `+2348${String(n).padStart(9, '0').slice(-9)}`;
  const a = new Client();

  await a.req('GET', '/auth/csrf');
  const reg = await a.req('POST', '/auth/register', { surname: 'Smoke', firstName: 'Tester', email, phone, password: 'Str0ng!Passw0rd', consent: true });
  step(`registered ${email}`);
  await a.req('POST', '/auth/otp/verify', { userId: reg.userId, channel: 'email', code: OTP });
  const v = await a.req('POST', '/auth/otp/verify', { userId: reg.userId, channel: 'phone', code: OTP });
  if (!v.complete) throw new Error('verification incomplete');
  step('email + phone verified with OTP');
  const login = await a.req('POST', '/auth/login', { email, password: 'Str0ng!Passw0rd' });
  if (!login.ok) throw new Error('login failed ' + JSON.stringify(login));
  step('logged in (session cookie issued)');

  const steps: Record<string, unknown> = {
    personal: { surname: 'Smoke', firstName: 'Tester', middleName: '', gender: 'male', dateOfBirth: `${year - 20}-03-10`, maritalStatus: 'single', nin: '12345678901', residentialAddress: '12 Broad Street, Lagos Island', stateOfResidence: 'LA' },
    origin: { stateOfOrigin: 'KN', lga: 'Kano Municipal', hometown: 'Kano' },
    education: { highestQualification: 'ssce', olevelCredits: 6, hasEnglishAndMaths: true, olevelSittings: 1, institutions: [{ name: 'Government College Kano', qualification: 'ssce', yearCompleted: year - 2 }] },
    physical: { heightCm: 175, weightKg: 70, genotype: 'AA', bloodGroup: 'O+', hasDisability: false, hasCriminalRecord: false },
    next_of_kin: { fullName: 'Amina Tester', relationship: 'parent', phone: '08031234567', address: '5 Market Road, Kano' },
    entry: { entryType: 'regular', preferredScreeningState: 'KN' },
  };
  let last: any;
  for (const [s, data] of Object.entries(steps)) last = await a.req('PUT', '/applications/draft', { step: s, data });
  if (!last.eligibility.eligible) throw new Error('expected eligible: ' + JSON.stringify(last.eligibility));
  step(`saved 6 steps (autosave), eligibility pre-check: eligible`);

  for (const [type, buf, ct] of [
    ['passport_photo', JPEG, 'image/jpeg'], ['olevel_certificate', PDF, 'application/pdf'],
    ['birth_certificate', PDF, 'application/pdf'], ['state_of_origin_letter', PDF, 'application/pdf'],
  ] as const) {
    const p = await a.req('POST', '/applications/documents/presign', { type, contentType: ct, size: buf.length });
    const form = new FormData();
    for (const [k, val] of Object.entries(p.fields as Record<string, string>)) form.append(k, val);
    form.append('file', new Blob([buf], { type: ct }));
    const up = await fetch(p.url, { method: 'POST', body: form });
    if (up.status >= 300) throw new Error(`S3 upload failed ${up.status} ${await up.text()}`);
    await a.req('POST', '/applications/documents/confirm', { type, key: p.key });
  }
  step('uploaded 4 documents directly to object storage via presigned POST');

  const sub = await a.req('POST', '/applications/submit', { declaration: true }, [202]);
  step(`submitted -> 202 ${sub.applicationNo} (${sub.status})`);
  await a.req('POST', '/applications/submit', { declaration: true }, [409]);
  step('double submission rejected with 409');

  let st: any;
  for (let i = 0; i < 30; i++) {
    st = (await a.req('GET', '/applications/me')).application;
    if (st?.status === 'submitted' && st.slipReady) break;
    await sleep(500);
  }
  if (!st?.slipReady) throw new Error('slip not generated: ' + JSON.stringify(st));
  const slip = await a.req('GET', '/applications/me/slip');
  const pdf = Buffer.from(await (await fetch(slip.url)).arrayBuffer());
  if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('slip is not a PDF');
  step(`worker persisted application and generated PDF slip (${pdf.length} bytes)`);

  // ---------------------------------------------------------------- admin
  const adm = new Client();
  await adm.req('GET', '/auth/csrf');
  let r = await adm.req('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (r.mfaSetupRequired) {
    const setup = await adm.req('POST', '/admin/auth/mfa/setup', { setupToken: r.setupToken });
    writeFileSync(TOTP_FILE, setup.secret);
    r = await adm.req('POST', '/admin/auth/mfa/enable', { setupToken: r.setupToken, code: totpAt(setup.secret, Math.floor(Date.now() / 30000)) });
    step('admin enrolled in mandatory 2FA');
  } else if (r.mfaRequired) {
    if (!existsSync(TOTP_FILE)) throw new Error(`admin has 2FA; put the secret in ${TOTP_FILE}`);
    // A code can be used once; wait for the next 30s window if the previous run used this one.
    const secret = readFileSync(TOTP_FILE, 'utf8').trim();
    const code = totpAt(secret, Math.floor(Date.now() / 30000) + 1);
    await sleep(30000 - (Date.now() % 30000) + 200);
    r = await adm.req('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, totp: code });
  }
  if (!r.ok) throw new Error('admin login failed ' + JSON.stringify(r));
  step('admin logged in with password + TOTP');

  const dash = await adm.req('GET', '/admin/dashboard');
  step(`dashboard: total=${dash.total}, states=${Object.keys(dash.byState).length}, statuses=${JSON.stringify(dash.byStatus)}`);
  const found = await adm.req('GET', `/admin/applicants?q=${encodeURIComponent(sub.applicationNo)}`);
  if (found.items.length !== 1) throw new Error('search by application no failed');
  const byEmail = await adm.req('GET', `/admin/applicants?q=${encodeURIComponent(email)}`);
  if (byEmail.items.length !== 1) throw new Error('search by email (blind index) failed');
  const page1 = await adm.req('GET', '/admin/applicants?state=KN&limit=5');
  const page2 = page1.nextCursor ? await adm.req('GET', `/admin/applicants?state=KN&limit=5&cursor=${page1.nextCursor}`) : { items: [] };
  step(`search: by application no, by email (blind index), keyset pages (${page1.items.length}+${page2.items.length} of ${page1.total} in Kano)`);
  const id = found.items[0].id;
  const detail = await adm.req('GET', `/admin/applicants/${id}`);
  if (detail.data.personal.nin !== '12345678901') throw new Error('PII decrypt failed');
  const doc = await adm.req('GET', `/admin/applicants/${id}/documents/passport_photo`);
  if (!doc.url.includes('X-Amz-Signature')) throw new Error('document URL not signed');
  step('viewed decrypted applicant detail and signed, expiring document URL');

  const bs = await adm.req('POST', '/admin/applicants/bulk/status', { ids: [id], status: 'shortlisted', note: 'Smoke test' });
  if (bs.updated !== 1) throw new Error('bulk shortlist failed ' + JSON.stringify(bs));
  const ex = (await adm.req('GET', '/admin/exercises')).find((e: any) => e.state === 'open');
  const centres = await adm.req('GET', `/admin/exercises/${ex.id}/centres`);
  const date = new Date(Date.now() + 14 * 86400000).toISOString();
  const sc = await adm.req('POST', '/admin/applicants/bulk/screening', { ids: [id], centreId: centres[0].id, screeningDate: date });
  if (sc.updated !== 1) throw new Error('screening failed');
  step(`bulk shortlisted and assigned screening at ${centres[0].name}`);

  const appView = (await a.req('GET', '/applications/me')).application;
  if (appView.status !== 'invited_for_screening' || !appView.screening) throw new Error('applicant does not see screening: ' + JSON.stringify(appView));
  step(`applicant sees status "${appView.status}" with venue ${appView.screening.centre}`);

  const exp = await adm.req('POST', '/admin/exports', { format: 'xlsx', filter: { state: 'KN' } });
  let done: any;
  for (let i = 0; i < 40; i++) {
    done = (await adm.req('GET', '/admin/exports')).find((e: any) => e.id === exp.id);
    if (done?.status === 'done' || done?.status === 'failed') break;
    await sleep(500);
  }
  if (done?.status !== 'done') throw new Error('export failed ' + JSON.stringify(done));
  const dl = await adm.req('GET', `/admin/exports/${exp.id}/download`);
  const xbuf = Buffer.from(await (await fetch(dl.url)).arrayBuffer());
  step(`Excel export: ${done.row_count} rows, ${xbuf.length} bytes (zip magic ${xbuf.subarray(0, 2).toString()})`);

  const audit = await adm.req('GET', '/admin/audit-logs?limit=10');
  step(`audit log entries: ${audit.map((x: any) => x.action).slice(0, 6).join(', ')}`);

  await new Client().req('GET', '/admin/dashboard', undefined, [401]);
  step('unauthenticated admin request rejected (401)');
  const noCsrf = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (noCsrf.status !== 403) throw new Error('CSRF not enforced');
  step('POST without CSRF token rejected (403)');
  console.log('\nSMOKE TEST PASSED');
}

main().catch((e) => {
  console.error('\nSMOKE TEST FAILED:', e.message);
  process.exit(1);
});
