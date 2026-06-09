// ReconciliationFlag — the per-row verdict in the planned-vs-actual diff (U13).
// COMPLETED/INCOMPLETE
// reflect the live ACTUAL status of a planned item; CARRIED marks an item rolled into next week;
// ADDED_AFTER_LOCK marks a live item with no frozen plan line (created after the snapshot/submit).
package com.solovis.wcm.commit.dto;

public enum ReconciliationFlag {
  COMPLETED,
  INCOMPLETE,
  CARRIED,
  ADDED_AFTER_LOCK
}
