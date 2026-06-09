// RallyCryResponse — wire shape returned by the admin RCDO CRUD endpoints for a RallyCry (root).
// Includes the id, all editable fields (title/description/date-window/owner) and the audit stamps
// (createdBy/createdDate) so the admin edit-tree can show provenance. The root has no parent id.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.RallyCry;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RallyCryResponse(
    UUID id,
    String title,
    String description,
    LocalDate startDate,
    LocalDate endDate,
    UUID ownerId,
    String createdBy,
    Instant createdDate) {

  public static RallyCryResponse from(RallyCry r) {
    return new RallyCryResponse(
        r.getId(),
        r.getTitle(),
        r.getDescription(),
        r.getStartDate(),
        r.getEndDate(),
        r.getOwnerId(),
        r.getCreatedBy(),
        r.getCreatedDate());
  }
}
