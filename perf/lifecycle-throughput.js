// lifecycle-throughput.js — k6 THROUGHPUT test for the write path: the full create -> link ->
// submit (DRAFT -> LOCKED) weekly-commit lifecycle, exercised concurrently as the seeded stress
// reports via the @Profile("e2e") dev-auth header. Each iteration: POST /api/commits (DRAFT with an
// UNLINKED item) -> PUT /api/commits/{id} (link the item to a real RCDO SupportingOutcome) -> POST
// /api/commits/{id}/submit (lock). Uniqueness: each VU owns one report and each iteration claims a
// distinct FUTURE week (within @WeekStartBounds), so the UNIQUE(member, week_start) constraint never
// collides WITHIN a run — run-stress.sh starts each run on a fresh DB, keeping it idempotent at the
// run level. Thresholds (HARD; breach => non-zero exit): every step 2xx, every lifecycle check
// passes, and a sane p95 on the write round-trips. setup() resolves one SupportingOutcome id once.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { API_BASE, asMember, reportEmail, parseJson } from './lib/config.js';

const VUS = Number(__ENV.LIFECYCLE_VUS || 6);
const ITERATIONS = Number(__ENV.LIFECYCLE_ITERATIONS || 90);
// p95 ceiling for a single write request in the create->link->submit chain. Writes are heavier than
// reads, so this bar is wider than the read NFR but still HARD (tunable, never removed).
const WRITE_P95_MS = Number(__ENV.LIFECYCLE_WRITE_P95_MS || 400);

const locked = new Counter('lifecycle_commits_locked');

export const options = {
  scenarios: {
    lifecycle: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: '60s',
      exec: 'lifecycle',
    },
  },
  thresholds: {
    'http_req_duration{scenario:lifecycle}': [`p(95)<${WRITE_P95_MS}`],
    'http_req_failed{scenario:lifecycle}': ['rate==0'],
    'checks': ['rate==1'],
    // Every iteration must complete a full create->link->submit (no silent skips).
    'lifecycle_commits_locked': [`count==${ITERATIONS}`],
  },
};

// Resolve a real SupportingOutcome id to link to (the submit guard requires every item linked).
export function setup() {
  const member = reportEmail(0);
  const res = http.get(`${API_BASE}/api/rcdo/supporting-outcomes`, asMember(member));
  const leaves = parseJson(res);
  if (!Array.isArray(leaves) || leaves.length === 0) {
    throw new Error('lifecycle setup: no SupportingOutcomes returned — is the demo seed loaded?');
  }
  return { supportingOutcomeId: leaves[0].id };
}

// Monday of the current week as an ISO date, computed once per VU init.
function currentMonday() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday;
}

function isoWeek(weeksFromNow) {
  const base = currentMonday();
  const d = new Date(base.getTime() + weeksFromNow * 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function lifecycle(data) {
  // Each VU owns a distinct report; each iteration claims a distinct future week per VU so
  // UNIQUE(member, week_start) never collides within the run. Offsets stay within @WeekStartBounds.
  const member = reportEmail(__VU + 1000); // a member range disjoint from the read scenarios' rows
  const weekOffset = 11 + (__ITER % 90); // weeks 0..9 are pre-seeded; start at +11, stay <= +101
  const weekStart = isoWeek(weekOffset);
  const params = asMember(member);

  // 1) CREATE a DRAFT with one UNLINKED item.
  const createRes = http.post(
    `${API_BASE}/api/commits`,
    JSON.stringify({ weekStart, items: [{ text: `perf lifecycle ${__VU}-${__ITER}` }] }),
    params,
  );
  const created = parseJson(createRes);
  const createOk = check(createRes, {
    'create -> 201': (r) => r.status === 201,
    'create returns a DRAFT id': () =>
      created !== null && typeof created.id === 'string' && created.lifecycleState === 'DRAFT',
  });
  if (!createOk || created === null) return;

  // 2) LINK the item to a real SupportingOutcome (PUT full-replace of the item set).
  const linkRes = http.put(
    `${API_BASE}/api/commits/${created.id}`,
    JSON.stringify({
      items: [
        {
          text: `perf lifecycle ${__VU}-${__ITER}`,
          supportingOutcomeId: data.supportingOutcomeId,
          chessTier: 'ROOK',
        },
      ],
    }),
    params,
  );
  const linked = parseJson(linkRes);
  const linkOk = check(linkRes, {
    'link -> 200': (r) => r.status === 200,
    'item is now linked': () =>
      linked !== null &&
      Array.isArray(linked.items) &&
      linked.items.length === 1 &&
      linked.items[0].supportingOutcomeId === data.supportingOutcomeId,
  });
  if (!linkOk) return;

  // 3) SUBMIT (DRAFT -> LOCKED). The submit guard passes now every item is linked.
  const submitRes = http.post(`${API_BASE}/api/commits/${created.id}/submit`, null, params);
  const submitted = parseJson(submitRes);
  const submitOk = check(submitRes, {
    'submit -> 200': (r) => r.status === 200,
    'commit is now LOCKED': () => submitted !== null && submitted.lifecycleState === 'LOCKED',
  });
  if (submitOk) {
    locked.add(1);
  }
}
