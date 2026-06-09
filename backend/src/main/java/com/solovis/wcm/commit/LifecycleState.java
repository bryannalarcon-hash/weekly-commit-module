// LifecycleState — the weekly-commit FSM states (server-enforced by LifecycleService).
// DRAFT -> LOCKED -> RECONCILING -> RECONCILED -> CARRY_FORWARD, with a LOCKED->CARRY_FORWARD
// escape hatch. Persisted as a string on weekly_commit.lifecycle_state.
package com.solovis.wcm.commit;

public enum LifecycleState {
  DRAFT,
  LOCKED,
  RECONCILING,
  RECONCILED,
  CARRY_FORWARD
}
