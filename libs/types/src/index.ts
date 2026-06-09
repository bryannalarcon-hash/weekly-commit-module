// libs/types — shared DTO/contract types for the Weekly Commit Module.
// Frozen API shapes (commits, items, RCDO nodes, lifecycle states) consumed by api + ui + apps.

/** Lifecycle states of a weekly commit (mirrors the backend FSM). */
export type LifecycleState =
  | 'DRAFT'
  | 'LOCKED'
  | 'RECONCILING'
  | 'RECONCILED'
  | 'CARRIED_FORWARD';

/** A single weekly commit record header. */
export interface WeeklyCommit {
  id: string;
  ownerId: string;
  weekStartIso: string;
  state: LifecycleState;
}
