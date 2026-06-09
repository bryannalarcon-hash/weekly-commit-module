// OutcomeRequest — create/update body for an admin RCDO Outcome (level 3). Carries the editable
// fields plus definingObjectiveId (its parent). On CREATE the service requires the parent to exist
// (else 404); on UPDATE the parent is NOT moved — only title/description/window/owner change — so
// definingObjectiveId is ignored by PUT. title is required (<=200); description capped at 2000.
package com.solovis.wcm.rcdo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record OutcomeRequest(
    UUID definingObjectiveId,
    @NotBlank @Size(max = 200) String title,
    @Size(max = 2000) String description,
    LocalDate startDate,
    LocalDate endDate,
    UUID ownerId) {}
