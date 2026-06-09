// libs/ui — shared presentational primitives barrel for the Weekly Commit Module.
// Tailwind + Flowbite React components (lifecycle badge, RCDO chip, etc.) land here in unit U5.
import type { LifecycleState } from '@wcm/types';

/** Maps a lifecycle state to a Flowbite color token; used by the upcoming LifecycleBadge. */
export function lifecycleColor(state: LifecycleState): string {
  switch (state) {
    case 'DRAFT':
      return 'gray';
    case 'LOCKED':
      return 'blue';
    case 'RECONCILING':
      return 'yellow';
    case 'RECONCILED':
      return 'green';
    case 'CARRY_FORWARD':
      return 'purple';
  }
}
