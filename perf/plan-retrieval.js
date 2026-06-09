// plan-retrieval.js — k6 LOAD test for the brief NFR "API <200ms for plan retrieval".
// Hammers GET /api/commits/current (an employee reading their current open week — the single
// indexed read the home screen makes) as the seeded stress reports, authenticating via the
// @Profile("e2e") dev-auth header. The threshold http_req_duration p95<200ms is HARD: k6 exits
// non-zero if breached, so run-stress.sh fails the run. The VU count is scoped to a realistic
// home-screen concurrency for this single-box dev environment (documented in perf/README.md); the
// 200ms bar itself is never relaxed. 204 (no current week) and 200 both count as success.
import http from 'k6/http';
import { check } from 'k6';
import { API_BASE, asMember, reportEmail, parseJson } from './lib/config.js';

// Realistic plan-retrieval concurrency for the dev box: a steady pool of employees opening their
// home screen. Tunable via PLAN_VUS / PLAN_DURATION without touching the 200ms threshold.
const VUS = Number(__ENV.PLAN_VUS || 20);
const DURATION = __ENV.PLAN_DURATION || '30s';

export const options = {
  scenarios: {
    plan_retrieval: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      exec: 'planRetrieval',
    },
  },
  thresholds: {
    // HARD NFR gate — breach => non-zero exit => failed run. p95 under 200ms; also no errors.
    'http_req_duration{scenario:plan_retrieval}': ['p(95)<200'],
    'http_req_failed{scenario:plan_retrieval}': ['rate==0'],
    'checks': ['rate==1'],
  },
};

export function planRetrieval() {
  // Spread reads across the ~210 seeded reports so no single hot row dominates the cache.
  const member = reportEmail(__VU * 7 + __ITER);
  const res = http.get(`${API_BASE}/api/commits/current`, asMember(member));
  check(res, {
    'current returns 200 or 204': (r) => r.status === 200 || r.status === 204,
    'current body is a commit when 200': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body !== null && typeof body.id === 'string';
    },
  });
}
