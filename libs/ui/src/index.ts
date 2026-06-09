// libs/ui — shared presentational primitives barrel for the Weekly Commit Module (design brief §7).
// Tailwind + Flowbite React components only (no CSS modules/styled-components). Exposes the design
// tokens, lifecycle badge, RCDO chip/breadcrumb, autosave indicator, past-due banner, carried-forward
// card, skeleton/empty/error primitives, confirm dialog, internal sub-nav, and the inline icon set.
import type { LifecycleState } from '@wcm/types';
import { LIFECYCLE_VISUAL } from './tokens';

export * from './tokens';
export * from './icons';
export * from './LifecycleBadge';
export * from './RcdoChip';
export * from './AutosaveIndicator';
export * from './PastDueBanner';
export * from './CarriedForwardCard';
export * from './StatePrimitives';
export * from './ConfirmDialog';
export * from './WcNavigation';

/**
 * Legacy helper: maps a lifecycle state to a Flowbite color token. Prefer LIFECYCLE_VISUAL /
 * LifecycleBadge; kept because the early WeeklyCommitApp scaffold imports it.
 */
export function lifecycleColor(state: LifecycleState): string {
  return LIFECYCLE_VISUAL[state].flowbiteColor;
}
