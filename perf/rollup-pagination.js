// rollup-pagination.js — k6 LOAD + CORRECTNESS test for the manager team roll-up over the brief's
// ~2000-record dataset (Pageable ≤2000). Drives GET /api/rollup as the seeded stress MANAGER, who
// owns ~210 reports aggregating ~2000 weekly commits. Each iteration walks ALL pages at a chosen
// page size and asserts STABLE PAGINATION: every page's rows are globally sorted (name,id), no id
// repeats across pages, the union covers exactly totalElements, and totalElements is constant. A
// HARD p95 threshold (k6 exits non-zero if breached) guards the read latency; failed requests and
// any failed correctness check also fail the run. Auth via the @Profile("e2e") dev-auth header.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { API_BASE, asMember, STRESS_MANAGER, parseJson } from './lib/config.js';

const PAGE_SIZE = Number(__ENV.ROLLUP_PAGE_SIZE || 50);
const VUS = Number(__ENV.ROLLUP_VUS || 8);
const DURATION = __ENV.ROLLUP_DURATION || '30s';
// p95 ceiling for ONE page fetch. The full-dataset (size=2000) single-page read is well under
// 200ms after the batch-load fix; a paged size=50 read is faster. Tunable, never removed.
const PAGE_P95_MS = Number(__ENV.ROLLUP_PAGE_P95_MS || 200);

const pagesWalked = new Counter('rollup_pages_walked');
const inconsistentPagination = new Counter('rollup_pagination_inconsistencies');

export const options = {
  scenarios: {
    rollup_pagination: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      exec: 'walkRollup',
    },
  },
  thresholds: {
    // HARD gate on per-page latency; breach => non-zero exit => failed run.
    'http_req_duration{scenario:rollup_pagination}': [`p(95)<${PAGE_P95_MS}`],
    'http_req_failed{scenario:rollup_pagination}': ['rate==0'],
    // Correctness: every pagination invariant held on every page; zero inconsistencies.
    'checks': ['rate==1'],
    'rollup_pagination_inconsistencies': ['count==0'],
  },
};

function fetchPage(page, size) {
  return http.get(`${API_BASE}/api/rollup?page=${page}&size=${size}`, asMember(STRESS_MANAGER));
}

export function walkRollup() {
  const params = asMember(STRESS_MANAGER);
  const first = http.get(`${API_BASE}/api/rollup?page=0&size=${PAGE_SIZE}`, params);
  const firstBody = parseJson(first);
  const ok = check(first, {
    'rollup page 0 is 200': (r) => r.status === 200,
    'rollup page 0 has a flat page envelope': () =>
      firstBody !== null &&
      Array.isArray(firstBody.content) &&
      typeof firstBody.totalElements === 'number' &&
      typeof firstBody.totalPages === 'number',
  });
  if (!ok || firstBody === null) {
    inconsistentPagination.add(1);
    return;
  }

  const totalElements = firstBody.totalElements;
  const totalPages = firstBody.totalPages;
  const seenIds = new Set();
  const allNames = [];

  for (let page = 0; page < totalPages; page++) {
    const res = page === 0 ? first : fetchPage(page, PAGE_SIZE);
    pagesWalked.add(1);
    const body = page === 0 ? firstBody : parseJson(res);

    const pageOk = check(res, {
      'rollup page status 200': (r) => r.status === 200,
      'rollup totalElements stable across pages': () =>
        body !== null && body.totalElements === totalElements,
    });
    if (!pageOk || body === null) {
      inconsistentPagination.add(1);
      continue;
    }
    for (const row of body.content) {
      // No id may appear on two pages (stable boundaries — the brief's 2000-record requirement).
      if (seenIds.has(row.memberId)) {
        inconsistentPagination.add(1);
      }
      seenIds.add(row.memberId);
      allNames.push(row.memberName);
    }
  }

  // The union of all pages must cover EXACTLY totalElements distinct reports.
  const coversAll = seenIds.size === totalElements;
  // Rows must be globally ordered (name asc) across page boundaries (the service's STABLE sort).
  const sorted = allNames.every(
    (n, i) => i === 0 || allNames[i - 1].localeCompare(n) <= 0,
  );
  const consistent = check(null, {
    'all reports covered exactly once across pages': () => coversAll,
    'reports globally sorted by name across pages': () => sorted,
  });
  if (!consistent) {
    inconsistentPagination.add(1);
  }
}
