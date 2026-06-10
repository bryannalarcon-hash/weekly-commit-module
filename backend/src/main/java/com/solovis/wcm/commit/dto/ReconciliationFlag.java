// ReconciliationFlag — the per-row verdict in the planned-vs-actual diff (U13).
// PENDING marks an item the IC hasn't judged yet (still OPEN / no actual recorded) — neutral, NOT a
// failure; COMPLETED/INCOMPLETE reflect the live ACTUAL status the IC explicitly recorded for a
// planned item; CARRIED marks an item rolled into next week; ADDED_AFTER_LOCK marks a live item
// with
// no frozen plan line (created after the snapshot/submit).
package com.solovis.wcm.commit.dto;

public enum ReconciliationFlag {
  PENDING,
  COMPLETED,
  INCOMPLETE,
  CARRIED,
  ADDED_AFTER_LOCK
}
