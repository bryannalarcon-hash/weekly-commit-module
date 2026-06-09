// OutcomeResponse — wire shape returned by the admin RCDO CRUD endpoints for a level-3 Outcome.
// Includes id + definingObjectiveId (parent) + all editable fields + the audit stamps
// (createdBy/createdDate) so the admin edit-tree can render the node with provenance.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.Outcome;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record OutcomeResponse(
    UUID id,
    UUID definingObjectiveId,
    String title,
    String description,
    LocalDate startDate,
    LocalDate endDate,
    UUID ownerId,
    String createdBy,
    Instant createdDate) {

  public static OutcomeResponse from(Outcome o) {
    return new OutcomeResponse(
        o.getId(),
        o.getDefiningObjectiveId(),
        o.getTitle(),
        o.getDescription(),
        o.getStartDate(),
        o.getEndDate(),
        o.getOwnerId(),
        o.getCreatedBy(),
        o.getCreatedDate());
  }
}
