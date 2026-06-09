// LockedCommitSync — the immutable input to CalendarSyncPort#syncLockedCommit (U16). A
// presentation-ready view of a just-LOCKED weekly commit: which member owns it, the week window
// (start..end), the planned item lines, and a deep-link back into the app. Decouples the calendar
// adapters from JPA entities so the port stays a clean domain seam. commitId doubles as the Graph
// idempotency key (transactionId) so a redelivered commit.locked event never double-books.
package com.solovis.wcm.integration;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record LockedCommitSync(
    UUID commitId,
    UUID memberId,
    LocalDate weekStart,
    LocalDate weekEnd,
    List<String> itemLines,
    String deepLink) {

  /**
   * Defensive-copy the item lines into an unmodifiable list so this value object is truly
   * immutable.
   */
  public LockedCommitSync {
    itemLines = itemLines == null ? List.of() : List.copyOf(itemLines);
  }

  /** Null-safe view of the planned item lines (always non-null after construction). */
  public List<String> safeItemLines() {
    return itemLines;
  }
}
