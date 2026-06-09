// CommitItemStatus — the ACTUAL outcome of a CommitItem (mutable only in RECONCILING per KTD4).
// OPEN at draft/lock; COMPLETE/INCOMPLETE recorded during reconciliation; CARRIED_FORWARD when an
// INCOMPLETE item is copied into the next week. Persisted as a string on commit_item.status.
package com.solovis.wcm.commit;

public enum CommitItemStatus {
  OPEN,
  COMPLETE,
  INCOMPLETE,
  CARRIED_FORWARD
}
