// libs/api — data-access barrel for the Weekly Commit Module (RTK Query only).
// Will host the RTK Query apiSlice + MSW handlers; no non-RTK-Query fetching is permitted here.
import type { WeeklyCommit } from '@wcm/types';

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
