// CalendarSyncPort — the outbound port for surfacing a LOCKED weekly commit as an Outlook calendar
// event (U16 / KTD7). Implementations: StubCalendarAdapter (in-memory, the test/default profile)
// and
// GraphCalendarAdapter (real delegated Microsoft Graph POST /me/events). Called asynchronously by
// the
// commit.locked consumer, never on the LOCK request path. Returns the created event's id (stored on
// the commit) and MUST be idempotent per commitId so a redelivered event does not double-book.
package com.solovis.wcm.integration;

public interface CalendarSyncPort {

  /**
   * Create (or return the existing) Outlook calendar event for a locked commit and return its event
   * id. Implementations dedup by {@link LockedCommitSync#commitId()} so repeated calls for the same
   * commit yield the same event id (idempotent — Graph via a stable transactionId).
   */
  String syncLockedCommit(LockedCommitSync commit);
}
