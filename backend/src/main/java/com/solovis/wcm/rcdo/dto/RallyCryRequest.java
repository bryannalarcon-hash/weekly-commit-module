// RallyCryRequest — create/update body for an admin RCDO RallyCry (the tree root). Carries the
// editable fields (title/description/date-window/owner); title is required (<=200) and description
// is capped at 2000 to match the column. The root has no parent, so no parent id is present. PUT
// reuses this shape (only the path id selects the row; the body never moves a node's parent).
package com.solovis.wcm.rcdo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record RallyCryRequest(
    @NotBlank @Size(max = 200) String title,
    @Size(max = 2000) String description,
    LocalDate startDate,
    LocalDate endDate,
    UUID ownerId) {}
