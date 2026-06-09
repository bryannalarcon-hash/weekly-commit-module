// perf/stress.js — k6 load script asserting the brief's <200ms read NFR for the WCM API.
// Drives the hot read paths (commits list, current week, RCDO tree, roll-up) under a short ramp and
// FAILS (non-zero k6 exit) if p95 latency exceeds 200ms or any request errors. Auth uses the
// hermetic @Profile("e2e") X-Debug-Member header so the run needs no Auth0 tenant; targets are the
// deterministic demo-seed members. Tunable via env: BASE_URL, DEBUG_MEMBER, K6_VUS, K6_DURATION.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
// Deterministic demo-seed manager (Marcus Hale) so /rollup returns rows; any seeded subject works
// for the employee reads. The e2e profile authenticates purely on this header (matched by email
// first, e.g. marcus@solovis.test) — no bearer token needed.
const DEBUG_MEMBER = __ENV.DEBUG_MEMBER || 'marcus@solovis.test';

export const options = {
  scenarios: {
    reads: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: __ENV.K6_RAMP || '5s', target: Number(__ENV.K6_VUS || 10) },
        { duration: __ENV.K6_DURATION || '15s', target: Number(__ENV.K6_VUS || 10) },
        { duration: '3s', target: 0 },
      ],
    },
  },
  // Gate: the brief's "API response times under 200ms for plan retrieval". p95 < 200ms, no errors.
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
  },
};

const HEADERS = { headers: { 'X-Debug-Member': DEBUG_MEMBER, Accept: 'application/json' } };

// The brief's perf-sensitive read endpoints: the employee plan-retrieval paths + the manager
// roll-up (Pageable). Each is a single indexed read the NFR calls out.
const READS = [
  '/actuator/health',
  '/api/commits',
  '/api/commits/current',
  '/api/rcdo/tree',
  '/api/rollup?page=0&size=50',
];

export default function () {
  for (const path of READS) {
    const res = http.get(`${BASE}${path}`, HEADERS);
    check(res, {
      [`${path} ok`]: (r) => r.status === 200 || r.status === 204,
      [`${path} <200ms`]: (r) => r.timings.duration < 200,
    });
  }
}
