// Quick sanity run (10 rps for 30s) before a big test:  k6 run loadtest/smoke.js
import http from 'k6/http';
import { check } from 'k6';
import { base, headers } from './lib.js';
export const options = { vus: 5, duration: '30s', thresholds: { http_req_failed: ['rate<0.01'] } };
export default function () {
  check(http.get(`${base()}/health/ready`), { ready: (r) => r.status === 200 });
  check(http.get(`${base()}/reference/exercise`, { headers: headers() }), { exercise: (r) => r.status === 200 });
}
