// config.js — shared k6 helpers for the WCM perf/load tier.
// Centralizes the API base URL and the @Profile("e2e") dev-auth header (X-Debug-Member) so every
// scenario authenticates to the secured API the same way k6 reaches it (no Auth0 tenant needed).
// Exposes the seeded stress identities (the StressSeeder's single manager + its ~210 reports) the
// load scenarios drive, plus a uniform JSON-parse helper. No state; pure config + helpers.
import { check } from 'k6';

// API base. From inside the grafana/k6 container the host is reached via host.docker.internal
// (mapped to the host gateway with --add-host in run-stress.sh); override with WCM_API_BASE.
export const API_BASE = __ENV.WCM_API_BASE || 'http://host.docker.internal:8080';

// The hermetic dev-auth header E2eSecurityConfig validates: its value names a SEEDED member by
// email. MANAGER members are granted SCOPE_reconcile:commits, so the manager-only /rollup route
// authorizes exactly as the prod JWT chain would.
export const DEBUG_HEADER = 'X-Debug-Member';

// Seeded stress identities (see StressSeeder): one manager owning ~210 reports / ~2000 commits.
export const STRESS_MANAGER = 'stress-mgr@solovis.test';
export const STRESS_REPORT_COUNT = 210;

/** A stress report's dev-auth email by index (0-based), for plan-retrieval / lifecycle scenarios. */
export function reportEmail(index) {
  return `stress-report-${index % STRESS_REPORT_COUNT}@solovis.test`;
}

/** Standard request params authenticating as {@code member} via the dev-auth header. */
export function asMember(member, extraHeaders = {}) {
  return { headers: { [DEBUG_HEADER]: member, 'Content-Type': 'application/json', ...extraHeaders } };
}

/** Parse a JSON body, returning null (not throwing) so a bad response fails a check, not the VU. */
export function parseJson(res) {
  try {
    return res.json();
  } catch (_e) {
    return null;
  }
}

/** Assert a 2xx (or an explicitly allowed status) and return whether it held. */
export function checkStatus(res, label, allowed = [200]) {
  return check(res, {
    [`${label} status ok`]: (r) => allowed.includes(r.status),
  });
}
