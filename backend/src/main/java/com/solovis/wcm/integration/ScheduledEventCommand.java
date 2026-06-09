// ScheduledEventCommand — the immutable input to CalendarSyncPort#scheduleEvent (CB-1): a manager
// scheduling an ad-hoc Outlook event (e.g. a 1:1) with one of their reports. Carries the ORGANIZER
// (the acting manager, whose delegated token creates the event), the report's display name/email
// (the attendee), the resolved subject, the start instant with its original offset, the duration,
// and an optional note for the event body. Built by OutlookService.schedule after row-level authz.
package com.solovis.wcm.integration;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ScheduledEventCommand(
    UUID organizerMemberId,
    String reportDisplayName,
    String reportEmail,
    String subject,
    OffsetDateTime start,
    int durationMinutes,
    String note) {}
