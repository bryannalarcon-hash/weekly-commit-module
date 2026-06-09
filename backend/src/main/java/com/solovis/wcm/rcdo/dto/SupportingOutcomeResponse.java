// SupportingOutcomeResponse — wire shape returned by the admin RCDO CRUD endpoints for the leaf
// SupportingOutcome. Includes id + outcomeId (parent) + all editable fields + the audit stamps
// (createdBy/createdDate). Distinct from the read-side SupportingOutcomeDto (picker projection):
// this is the full admin edit-tree view, that one is the slim breadcrumb-able picker row.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.SupportingOutcome;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SupportingOutcomeResponse(
    UUID id,
    UUID outcomeId,
    String title,
    String description,
    LocalDate startDate,
    LocalDate endDate,
    UUID ownerId,
    String createdBy,
    Instant createdDate) {

  public static SupportingOutcomeResponse from(SupportingOutcome s) {
    return new SupportingOutcomeResponse(
        s.getId(),
        s.getOutcomeId(),
        s.getTitle(),
        s.getDescription(),
        s.getStartDate(),
        s.getEndDate(),
        s.getOwnerId(),
        s.getCreatedBy(),
        s.getCreatedDate());
  }
}
