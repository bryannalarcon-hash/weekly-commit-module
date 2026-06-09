// libs/api — data-access barrel for the Weekly Commit Module (RTK Query only).
// Hosts the MSW request handlers mirroring the U10 contract (./msw) so FE units build against mocks;
// the RTK Query apiSlice lands in U17. No non-RTK-Query fetching is permitted in app/runtime code.
import type { WeeklyCommit } from '@wcm/types';

export { handlers, resetMockDb, MOCK_MEMBER_ID } from './msw/handlers';

/** Placeholder until the RTK Query apiSlice lands (unit U17). */
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
