// CalendarSyncPort — the outbound port for Outlook calendar writes (U16 / KTD7 / CB-1).
// Implementations: StubCalendarAdapter (in-memory, the test/default profile) and
// GraphCalendarAdapter (real delegated Microsoft Graph POST /me/events). syncLockedCommit surfaces
// a LOCKED weekly commit as an event (called asynchronously by the commit.locked consumer, never on
// the LOCK request path; idempotent per commitId). scheduleEvent creates an ad-hoc manager-driven
// event (CB-1 "Schedule from the manager surface") with the organizer's delegated token.
package com.solovis.wcm.integration;

public interface CalendarSyncPort {

  /**
   * Create (or return the existing) Outlook calendar event for a locked commit and return its event
   * id. Implementations dedup by {@link LockedCommitSync#commitId()} so repeated calls for the same
   * commit yield the same event id (idempotent — Graph via a stable transactionId).
   */
  String syncLockedCommit(LockedCommitSync commit);

  /**
   * Create an ad-hoc Outlook event ON BEHALF of the organizer (CB-1): the acting manager's
   * delegated token creates the event with the report as a required attendee. Returns the created
   * event's id.
   */
  String scheduleEvent(ScheduledEventCommand cmd);
}
