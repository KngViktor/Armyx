/**
 * Recruitment-opening spike test.
 *
 * Models the moment an exercise opens: baseline traffic (~60 rps, the
 * 5M-requests/day average), then a sharp ramp to TARGET_RPS, held, then decay.
 * Two scenarios run together:
 *
 *  - portal_mix (ramping-arrival-rate): signed-in applicants doing what real
 *    applicants do — status checks, loading/saving drafts (autosave), LGA
 *    lookups, re-logins and new registrations.
 *  - submissions: a wave of applicants completing the 6 steps and submitting
 *    (queued write path) as fast as they can.
 *
 * Public website pages are NOT included: they are static files served by the
 * CDN and never reach the origin (see docs/LOAD-TESTING.md).
 *
 *   k6 run -e TARGET_RPS=3000 -e API_BASES=https://army.mil.ng loadtest/recruitment-spike.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';
import { base, headers, login, shareCookies, STEPS, USERS, ipFor, BASES } from './lib.js';

const TARGET = Number(__ENV.TARGET_RPS || 3000);
const BASELINE = Number(__ENV.BASELINE_RPS || 60);
const HOLD = __ENV.HOLD || '3m';
const SUBMITTERS = Number(__ENV.SUBMITTERS || 1500);
/** Average seconds an applicant spends per form section. Real users take minutes; 2s is a deliberately compressed wave. */
const THINK = Number(__ENV.THINK ?? 2);

const rateLimited = new Counter('rate_limited_429');
const shed = new Counter('load_shed_503');
const submitted = new Counter('applications_submitted');
const submitLatency = new Trend('submit_latency', true);

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409, 429));

export const options = {
  discardResponseBodies: false,
  // Keep each VU's session + CSRF cookies across iterations (a real browser keeps them).
  noCookiesReset: true,
  scenarios: {
    portal_mix: {
      executor: 'ramping-arrival-rate',
      startRate: BASELINE,
      timeUnit: '1s',
      preAllocatedVUs: Math.min(4000, Math.ceil(TARGET / 2)),
      maxVUs: Math.min(8000, TARGET * 2),
      stages: [
        { target: BASELINE, duration: '1m' },   // normal day
        { target: TARGET, duration: '30s' },    // recruitment opens: sharp spike
        { target: TARGET, duration: HOLD },     // sustained peak
        { target: Math.round(TARGET / 3), duration: '1m' },
        { target: BASELINE, duration: '30s' },
      ],
      exec: 'portalMix',
    },
    submissions: {
      executor: 'per-vu-iterations',
      vus: Math.min(SUBMITTERS, 1500),
      iterations: Math.max(1, Math.floor(SUBMITTERS / Math.min(SUBMITTERS, 1500))),
      startTime: '1m',
      maxDuration: '10m',
      exec: 'submitFlow',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:portal_mix}': ['p(95)<500', 'p(99)<1500'],
    submit_latency: ['p(95)<1000'],
    checks: ['rate>0.99'],
    // Per-endpoint latency (also makes k6 report each one in the summary).
    'http_req_duration{name:status}': ['p(95)<300'],
    'http_req_duration{name:exercise}': ['p(95)<300'],
    'http_req_duration{name:lgas}': ['p(95)<300'],
    'http_req_duration{name:draft_get}': ['p(95)<300'],
    'http_req_duration{name:draft_save}': ['p(95)<500'],
    'http_req_duration{name:login}': ['p(95)<1000'],
    'http_req_duration{name:register}': ['p(95)<1500'],
    'http_req_duration{name:submit}': ['p(95)<1000'],
  },
};

// Accounts n % 10 < 7 have submitted (status checks); n % 10 >= 7 are free for the submission wave.
function submittedAccount(vu) {
  const i = (vu * 7) % USERS;
  return i - (i % 10) + (i % 7);
}
function unsubmittedAccount(k) {
  const n = Math.floor(k / 3) * 10 + 7 + (k % 3);
  if (n >= USERS) throw new Error(`SUBMIT_OFFSET + SUBMITTERS exceeds the seeded pool (${Math.floor((USERS * 3) / 10)} unsubmitted accounts)`);
  return n;
}

const loggedIn = {};

export function portalMix() {
  const vu = exec.vu.idInTest;
  if (!loggedIn[vu]) {
    loggedIn[vu] = login(`loadtest+${submittedAccount(vu)}@example.ng`);
    return;
  }
  const r = Math.random();
  let res;
  if (r < 0.30) res = http.get(`${base()}/applications/me`, { headers: headers(), tags: { name: 'status' } });
  else if (r < 0.50) res = http.get(`${base()}/reference/exercise`, { headers: headers(), tags: { name: 'exercise' } });
  else if (r < 0.62) res = http.get(`${base()}/reference/states/${['LA', 'KN', 'OY', 'RI', 'KD', 'FC'][vu % 6]}/lgas`, { headers: headers(), tags: { name: 'lgas' } });
  else if (r < 0.80) res = http.get(`${base()}/applications/draft`, { headers: headers(), tags: { name: 'draft_get' } });
  else if (r < 0.95) {
    // Autosave on an account that already submitted returns 409 — expected; exercises the full validation + Redis path.
    res = http.put(`${base()}/applications/draft`, JSON.stringify({ step: 'physical', data: STEPS(vu).physical }), { headers: headers(), tags: { name: 'draft_save' } });
  } else if (r < 0.98) {
    // A returning applicant signing in (random account; argon2id verification is the expensive part).
    const acct = submittedAccount(Math.floor(Math.random() * USERS));
    res = http.post(`${base()}/auth/login`, JSON.stringify({ email: `loadtest+${acct}@example.ng`, password: 'Applicant#2026' }), { headers: headers(), tags: { name: 'login' } });
    shareCookies();
  } else {
    const n = `${vu}${exec.scenario.iterationInTest}${Date.now() % 100000}`;
    res = http.post(`${base()}/auth/register`, JSON.stringify({
      surname: 'Spike', firstName: 'Tester', email: `spike+${n}@example.ng`, phone: `+23480${String(n).padStart(8, '0').slice(-8)}`,
      password: 'Str0ng!Passw0rd', consent: true,
    }), { headers: headers({ 'CF-Connecting-IP': ipFor(100000 + exec.scenario.iterationInTest) }), tags: { name: 'register' } });
  }
  if (res.status === 429) rateLimited.add(1);
  if (res.status === 503) shed.add(1);
  check(res, { 'status ok': (x) => x.status < 300 || x.status === 409 || x.status === 429 });
}

/** Mirrors the portal client: retry 503 (load shedding / waiting room) after Retry-After. */
function withRetry(fn) {
  let r;
  for (let i = 0; i < 6; i++) {
    r = fn();
    if (r.status !== 503) return r;
    shed.add(1);
    sleep(Number(r.headers['Retry-After'] || 2) * (0.75 + Math.random() * 0.5));
  }
  return r;
}

export function submitFlow() {
  // iterationInTest is unique per submission (VU ids are shared with the other scenario).
  const k = Number(__ENV.SUBMIT_OFFSET || 0) + exec.scenario.iterationInTest;
  const email = `loadtest+${unsubmittedAccount(k)}@example.ng`;
  let ok = false;
  for (let i = 0; i < 6 && !ok; i++) {
    ok = login(email);
    if (!ok) sleep(2 + Math.random() * 3); // shed / slow: back off like the portal client
  }
  if (!ok) return;
  const steps = STEPS(k);
  for (const step of Object.keys(steps)) {
    const r = withRetry(() => http.put(`${base()}/applications/draft`, JSON.stringify({ step, data: steps[step] }), { headers: headers(), tags: { name: 'draft_save' } }));
    check(r, { 'step saved': (x) => x.status === 200 || x.status === 409 });
    sleep(THINK * (0.5 + Math.random())); // time spent filling in the next section (compressed)
  }
  const s = withRetry(() => http.post(`${base()}/applications/submit`, JSON.stringify({ declaration: true }), { headers: headers(), tags: { name: 'submit' } }));
  submitLatency.add(s.timings.duration);
  if (s.status === 202) submitted.add(1);
  check(s, { 'submitted (202) or already (409)': (x) => x.status === 202 || x.status === 409 });
}

export function handleSummary(data) {
  const out = {};
  out[`loadtest/results/summary-${TARGET}rps.json`] = JSON.stringify(data, null, 2);
  out.stdout = textSummary(data);
  return out;
}

function textSummary(d) {
  const m = d.metrics;
  const v = (name, k) => (m[name] && m[name].values[k] !== undefined ? m[name].values[k] : NaN);
  const ms = (x) => `${x.toFixed(1)}ms`;
  const lines = [
    `\n=== Recruitment spike: target ${TARGET} rps against ${BASES.length} API instance(s) ===`,
    `requests            ${v('http_reqs', 'count')}  (${v('http_reqs', 'rate').toFixed(0)}/s avg over the whole run)`,
    `failed (unexpected) ${(v('http_req_failed', 'rate') * 100).toFixed(2)}%`,
    `latency all         p50 ${ms(v('http_req_duration', 'med'))}  p95 ${ms(v('http_req_duration', 'p(95)'))}  max ${ms(v('http_req_duration', 'max'))}`,
    `peak arrival rate   ${TARGET} rps (portal_mix) + submission wave of ${SUBMITTERS}`,
    `submissions         ${v('applications_submitted', 'count')} accepted, submit p95 ${ms(v('submit_latency', 'p(95)'))}`,
    `rate limited (429)  ${v('rate_limited_429', 'count') || 0}   load shed (503) ${v('load_shed_503', 'count') || 0}`,
    `checks passed       ${(v('checks', 'rate') * 100).toFixed(2)}%`,
  ];
  for (const [name, t] of Object.entries(d.metrics)) {
    if (name.startsWith('http_req_duration{name:')) lines.push(`  ${name.slice(23, -1).padEnd(14)} p50 ${ms(t.values.med).padStart(9)}  p95 ${ms(t.values['p(95)']).padStart(9)}  max ${ms(t.values.max).padStart(9)}`);
  }
  return lines.join('\n') + '\n';
}
