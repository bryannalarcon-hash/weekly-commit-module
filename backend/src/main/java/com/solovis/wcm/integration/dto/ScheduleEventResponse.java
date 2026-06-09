// ScheduleEventResponse — response of POST /api/integration/outlook/schedule (CB-1): the id of the
// Outlook event the CalendarSyncPort created for the manager's ad-hoc schedule request.
package com.solovis.wcm.integration.dto;

public record ScheduleEventResponse(String eventId) {}
