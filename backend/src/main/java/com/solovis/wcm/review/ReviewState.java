// ReviewState — the manager-review state of a WeeklyCommit's ManagerReview.
// UNREVIEWED (default) -> INCOMPLETE (started) -> REVIEWED. The FSM invariant: a WeeklyCommit can
// reach RECONCILED only when its ManagerReview is REVIEWED. Persisted on manager_review.state.
package com.solovis.wcm.review;

public enum ReviewState {
  UNREVIEWED,
  INCOMPLETE,
  REVIEWED
}
