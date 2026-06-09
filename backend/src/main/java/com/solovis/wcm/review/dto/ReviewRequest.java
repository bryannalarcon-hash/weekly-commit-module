// ReviewRequest — body of POST /commits/{id}/review (U14): a manager's per-commit review write.
// Carries the new ReviewState and an optional comment. The reviewer identity is the acting manager
// (CurrentMemberProvider), never a body field. Mirrored by the TS ReviewRequest.
package com.solovis.wcm.review.dto;

import com.solovis.wcm.review.ReviewState;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReviewRequest(@NotNull ReviewState state, @Size(max = 2000) String comment) {}
