// DefiningObjectiveResponse — wire shape returned by the admin RCDO CRUD endpoints for a level-2
// DefiningObjective. Includes id + rallyCryId (parent) + all editable fields + the audit stamps
// (createdBy/createdDate) so the admin edit-tree can render the node with provenance.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.DefiningObjective;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record DefiningObjectiveResponse(
    UUID id,
    UUID rallyCryId,
    String title,
    String description,
    LocalDate startDate,
    LocalDate endDate,
    UUID ownerId,
    String createdBy,
    Instant createdDate) {

  public static DefiningObjectiveResponse from(DefiningObjective d) {
    return new DefiningObjectiveResponse(
        d.getId(),
        d.getRallyCryId(),
        d.getTitle(),
        d.getDescription(),
        d.getStartDate(),
        d.getEndDate(),
        d.getOwnerId(),
        d.getCreatedBy(),
        d.getCreatedDate());
  }
}
