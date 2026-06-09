// libs/api — data-access barrel for the Weekly Commit Module (RTK Query ONLY; no fetch/axios in app
// code). Exposes the commitApi slice + generated hooks (U17), its cache-tag helpers, the store factory,
// the injectable token provider (host getToken / self-Auth0 / test mock), and the MSW handlers (U10)
// that let FE units build + test against mocks before the Spring controllers exist.
import type { WeeklyCommit } from '@wcm/types';

export {
  handlers,
  resetMockDb,
  MOCK_MEMBER_ID,
  __setMockOutlookConnected,
} from './msw/handlers';

export * from './commitApi';
export * from './tags';
export * from './store';
export {
  setTokenGetter,
  clearTokenGetter,
  getAccessToken,
  type TokenGetter,
} from './tokenProvider';

/** Base API path constant (kept for callers that need the raw mount point). */
export const API_BASE_PATH = '/api';

/** Narrow type-guard used by early UI wiring; replaced by generated selectors. */
export function isWeeklyCommit(value: unknown): value is WeeklyCommit {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'state' in value
  );
}
