// Shared helpers for the k6 scripts.
import http from 'k6/http';
import { check } from 'k6';

// Comma-separated list of API base URLs (round-robin = several pods / an LB).
export const BASES = (__ENV.API_BASES || 'http://localhost:4000').split(',');
export const ORIGIN = __ENV.ORIGIN || 'http://localhost:3000';
export const PASSWORD = __ENV.APPLICANT_PASSWORD || 'Applicant#2026';
export const USERS = Number(__ENV.SEED_USERS || 20000);

export const base = () => BASES[(__VU + __ITER) % BASES.length] + '/api/v1';

// Each VU looks like a distinct client IP. In production Cloudflare sets
// CF-Connecting-IP itself and the origin only accepts traffic from Cloudflare.
export function ipFor(vu) {
  return `10.${(vu >> 16) & 255}.${(vu >> 8) & 255}.${vu & 255}`;
}

export function headers(extra = {}) {
  const jar = http.cookieJar();
  const csrf = jar.cookiesForURL(BASES[0])['csrf'];
  return Object.assign(
    { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': ipFor(__VU) },
    csrf && csrf.length ? { 'X-CSRF-Token': csrf[0] } : {},
    extra,
  );
}

/** All API pods share cookies in production (same origin); mirror that across BASES. */
export function shareCookies() {
  const jar = http.cookieJar();
  const c = jar.cookiesForURL(BASES[0]);
  for (const b of BASES.slice(1)) for (const k of Object.keys(c)) jar.set(b, k, c[k][0]);
}

export function login(email) {
  http.get(`${BASES[0]}/api/v1/auth/csrf`, { headers: headers(), tags: { name: 'csrf' } });
  const r = http.post(`${BASES[0]}/api/v1/auth/login`, JSON.stringify({ email, password: PASSWORD }), { headers: headers(), tags: { name: 'login' } });
  check(r, { 'login ok': (x) => x.status === 200 && x.json('ok') === true });
  shareCookies();
  return r.status === 200;
}

export const STEPS = (n) => ({
  personal: { surname: 'Load', firstName: 'Tester', middleName: '', gender: 'male', dateOfBirth: '2006-04-12', maritalStatus: 'single', nin: String(20000000000 + n), residentialAddress: '10 Load Test Close, Ikeja', stateOfResidence: 'LA' },
  origin: { stateOfOrigin: 'OY', lga: 'Ibadan North', hometown: 'Ibadan' },
  education: { highestQualification: 'ssce', olevelCredits: 6, hasEnglishAndMaths: true, olevelSittings: 1, institutions: [{ name: 'Government College Ibadan', qualification: 'ssce', yearCompleted: 2024 }] },
  physical: { heightCm: 174, weightKg: 68, genotype: 'AA', bloodGroup: 'O+', hasDisability: false, hasCriminalRecord: false },
  next_of_kin: { fullName: 'Parent Tester', relationship: 'parent', phone: '08030000000', address: '10 Load Test Close, Ikeja' },
  entry: { entryType: 'regular', preferredScreeningState: 'OY' },
});
