'use client';
/**
 * DEMO MODE ONLY (NEXT_PUBLIC_DEMO_MODE=true).
 *
 * A self-contained, in-browser stand-in for the recruitment API so the portal
 * and admin console can be previewed on static hosting (e.g. Vercel) without
 * the NestJS API, PostgreSQL, Redis, S3 or workers. Everything lives in this
 * browser's localStorage — nothing typed into the demo leaves the device.
 */
import {
  APPLICATION_STATUSES, DEFAULT_RULES, NIGERIAN_STATES, generateApplicationId, ageOn,
  type ApplicationStatus, type DocumentType, type EligibilityRules,
} from '@armyx/shared';

import { DEMO_ADMIN, DEMO_APPLICANT } from './constants';
export * from './constants';

export interface DemoUser {
  id: string; surname: string; firstName: string; email: string; phone: string; password: string;
  emailVerified: boolean; phoneVerified: boolean; twoFactor: boolean; createdAt: string;
}
export interface DemoDoc { type: DocumentType; status: 'pending' | 'verified' | 'rejected'; size: number; contentType: string; name: string; dataUrl?: string }
export interface DemoApp {
  id: string; applicationNo: string; userId: string; status: ApplicationStatus; entryType: string; trade?: string;
  surname: string; firstName: string; gender: string; age: number; state: string; lga: string; qualification: string;
  heightCm: number; submittedAt: string; data: any; screening?: { centreId: string; date: string } | null;
  history: { from: string | null; to: string; at: string; actor?: string; note?: string }[]; slipReady: boolean;
}
export interface DemoState {
  version: number;
  exercise: { id: string; code: string; title: string; state: 'draft' | 'open' | 'closed'; opensAt: string; closesAt: string; rules: EligibilityRules; quotas: Record<string, number>; createdAt: string };
  users: DemoUser[];
  sessionUserId: string | null;
  admin: { loggedIn: boolean; email: string; role: 'super_admin' };
  admins: { id: string; email: string; full_name: string; role: string; active: boolean; totp_enabled: boolean; last_login_at: string | null; created_at: string }[];
  drafts: Record<string, { data: Record<string, any>; stepsDone: string[]; updatedAt: string }>;
  docs: Record<string, DemoDoc[]>;
  apps: DemoApp[];
  centres: { id: string; exercise_id: string; name: string; state_code: string; address: string; capacity_per_day: number; created_at: string }[];
  audit: { id: number; actor_email: string; actor_role: string; action: string; entity_type?: string; entity_id?: string; details: any; ip: string; created_at: string }[];
  exports: { id: string; format: string; status: string; row_count: number; created_at: string; completed_at: string; filter: any }[];
}

const KEY = 'armyx-demo-v1';

export const uid = () => crypto.randomUUID();
const rb = () => crypto.getRandomValues(new Uint8Array(8));

/** Small deterministic PRNG so every visitor sees the same sample data. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const SURNAMES = ['ABUBAKAR', 'ADEYEMI', 'OKAFOR', 'BELLO', 'EZE', 'IBRAHIM', 'OKON', 'ADEBAYO', 'MUSA', 'NWOSU', 'DANJUMA', 'OGUNLEYE', 'ETIM', 'YUSUF', 'CHUKWU', 'LAWAL', 'EKPO', 'GARBA', 'OJO', 'UCHE', 'SULEIMAN', 'AKPAN', 'OLAWALE', 'OBI', 'USMAN', 'BASSEY', 'ALIYU', 'OGBONNA', 'SHEHU', 'IKE'];
const FIRST = ['Musa', 'Chinedu', 'Aisha', 'Tunde', 'Ngozi', 'Ibrahim', 'Emeka', 'Fatima', 'Segun', 'Amina', 'Uchenna', 'Bola', 'Hauwa', 'Ifeanyi', 'Kemi', 'Sani', 'Blessing', 'Yakubu', 'Chiamaka', 'Femi', 'Zainab', 'Obinna', 'Halima', 'Kelechi', 'Funmi'];

function seed(): DemoState {
  const r = rng(2026);
  const now = Date.now();
  const year = new Date().getFullYear();
  const exId = 'demo-exercise';
  const closes = new Date(now + 40 * 86400000).toISOString();
  const centres = [
    ['Ojo Cantonment', 'LA', 'Ojo Cantonment, Ojo, Lagos'], ['Mogadishu Cantonment', 'FC', 'Mogadishu Cantonment, Asokoro, Abuja'],
    ['Depot Nigerian Army', 'KD', 'Depot NA, Zaria, Kaduna'], ['Odogbo Barracks', 'OY', 'Odogbo Barracks, Ibadan, Oyo'],
    ['Bori Camp', 'RI', 'Bori Camp, Port Harcourt, Rivers'], ['Abakpa Cantonment', 'EN', 'Abakpa Cantonment, Enugu'],
  ].map(([name, state_code, address], i) => ({ id: `centre-${i}`, exercise_id: exId, name, state_code, address, capacity_per_day: 500, created_at: new Date(now - 5 * 86400000).toISOString() }));

  const statuses: ApplicationStatus[] = ['submitted', 'submitted', 'submitted', 'under_review', 'under_review', 'shortlisted', 'rejected', 'invited_for_screening'];
  const entries = ['regular', 'regular', 'regular', 'specialist', 'short_service'];
  const apps: DemoApp[] = [];
  for (let i = 0; i < 480; i++) {
    const st = NIGERIAN_STATES[Math.floor(r() * NIGERIAN_STATES.length)]!;
    const lga = st.lgas[Math.floor(r() * st.lgas.length)]!;
    const gender = r() < 0.22 ? 'female' : 'male';
    const entryType = entries[Math.floor(r() * entries.length)]!;
    const status = statuses[Math.floor(r() * statuses.length)]!;
    const dob = `${year - 19 - Math.floor(r() * 3)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`;
    const surname = SURNAMES[Math.floor(r() * SURNAMES.length)]!;
    const firstName = FIRST[Math.floor(r() * FIRST.length)]!;
    // Spike-shaped submission times over the last 4 days.
    const day = Math.floor(r() * r() * 4);
    const submittedAt = new Date(now - day * 86400000 - Math.floor(r() * 20 * 3600000)).toISOString();
    const heightCm = 166 + Math.floor(r() * 22);
    const qualification = entryType === 'short_service' ? 'bsc' : r() < 0.85 ? 'ssce' : 'nd';
    apps.push({
      id: `app-${i}`, applicationNo: generateApplicationId('RRI', year, Uint8Array.from({ length: 8 }, () => Math.floor(r() * 256))),
      userId: `sample-${i}`, status, entryType, trade: entryType === 'specialist' ? 'driver' : undefined, surname, firstName, gender,
      age: ageOn(dob, new Date(closes)), state: st.code, lga, qualification, heightCm, submittedAt, slipReady: true,
      screening: status === 'invited_for_screening' ? { centreId: centres[i % centres.length]!.id, date: new Date(now + 14 * 86400000).toISOString() } : null,
      history: [{ from: null, to: 'submitted', at: submittedAt, note: 'Online submission' }, ...(status !== 'submitted' ? [{ from: 'submitted', to: status, at: new Date(Date.parse(submittedAt) + 86400000).toISOString(), actor: 'Recruitment Officer' }] : [])],
      data: {
        personal: { surname, firstName, middleName: '', gender, dateOfBirth: dob, maritalStatus: 'single', nin: String(10000000000 + i * 7919), residentialAddress: `${1 + i % 80} Sample Street, ${st.name}`, stateOfResidence: st.code },
        origin: { stateOfOrigin: st.code, lga, hometown: st.name },
        education: { highestQualification: qualification, olevelCredits: 5 + (i % 4), hasEnglishAndMaths: true, olevelSittings: 1 + (i % 2), institutions: [{ name: 'Government Secondary School', qualification: 'ssce', yearCompleted: year - 2 }] },
        physical: { heightCm, weightKg: 60 + (i % 20), genotype: 'AA', bloodGroup: 'O+', hasDisability: false, hasCriminalRecord: false },
        next_of_kin: { fullName: `${FIRST[(i + 3) % FIRST.length]} ${surname}`, relationship: 'parent', phone: '+2348030000000', address: `${st.name} State` },
        entry: { entryType, trade: entryType === 'specialist' ? 'driver' : undefined, preferredScreeningState: st.code },
        _contact: { email: `applicant${i}@example.ng`, phone: `+23480${String(30000000 + i).slice(-8)}` },
      },
    });
  }

  const created = new Date(now - 10 * 86400000).toISOString();
  return {
    version: 1,
    exercise: { id: exId, code: 'RRI', title: `${year} Regular Recruit Intake (RRI)`, state: 'open', opensAt: new Date(now - 4 * 86400000).toISOString(), closesAt: closes, rules: DEFAULT_RULES, quotas: Object.fromEntries(NIGERIAN_STATES.map((s) => [s.code, 400])), createdAt: created },
    users: [{ id: 'demo-applicant', surname: 'DEMO', firstName: 'Applicant', email: DEMO_APPLICANT.email, phone: '+2348031234567', password: DEMO_APPLICANT.password, emailVerified: true, phoneVerified: true, twoFactor: false, createdAt: created }],
    sessionUserId: null,
    admin: { loggedIn: false, email: DEMO_ADMIN.email, role: 'super_admin' },
    admins: [
      { id: 'adm-1', email: DEMO_ADMIN.email, full_name: 'Demo Recruitment Officer', role: 'super_admin', active: true, totp_enabled: true, last_login_at: null, created_at: created },
      { id: 'adm-2', email: 'reviewer@demo.army', full_name: 'Capt. Demo Reviewer', role: 'reviewer', active: true, totp_enabled: true, last_login_at: created, created_at: created },
      { id: 'adm-3', email: 'viewer@demo.army', full_name: 'Lt. Demo Viewer', role: 'viewer', active: true, totp_enabled: false, last_login_at: null, created_at: created },
    ],
    drafts: {}, docs: {}, apps, centres, exports: [],
    audit: [{ id: 1, actor_email: DEMO_ADMIN.email, actor_role: 'super_admin', action: 'exercise.open', entity_type: 'exercise', entity_id: exId, details: {}, ip: '127.0.0.1', created_at: created }],
  };
}

let cache: DemoState | null = null;

export function load(): DemoState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) cache = JSON.parse(raw) as DemoState;
  } catch { /* storage unavailable or corrupted: start fresh */ }
  if (!cache || cache.version !== 1) cache = seed();
  return cache;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded (large photos): drop stored images and retry once.
    for (const list of Object.values(cache!.docs)) for (const d of list) delete d.dataUrl;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* keep in memory only */ }
  }
}

export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  cache = null;
}

export const newApplicationNo = () => generateApplicationId('RRI', new Date(load().exercise.closesAt).getUTCFullYear(), rb());
export { APPLICATION_STATUSES };
