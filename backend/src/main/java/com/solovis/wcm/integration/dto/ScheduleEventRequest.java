// ScheduleEventRequest — body of POST /api/integration/outlook/schedule (CB-1): a manager
// scheduling an ad-hoc Outlook event with one of their reports. subject blank -> defaults to
// "1:1 — <report displayName>"; durationMinutes null -> 30 (service-side defaults).
package com.solovis.wcm.integration.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ScheduleEventRequest(
    @NotNull UUID reportMemberId,
    @Size(max = 200) String subject,
    @NotNull OffsetDateTime startDateTime,
    @Min(15) @Max(240) Integer durationMinutes,
    @Size(max = 2000) String note) {}
