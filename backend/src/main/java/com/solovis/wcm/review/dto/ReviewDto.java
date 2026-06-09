// ReviewDto — wire shape of a ManagerReview (U14): the review id, the commit it covers, the
// reviewer (acting manager), state, comment and reviewedAt. Response of the review write endpoint.
// Mirrored by the TS ReviewDto.
package com.solovis.wcm.review.dto;

import com.solovis.wcm.review.ManagerReview;
import com.solovis.wcm.review.ReviewState;
import java.time.Instant;
import java.util.UUID;

public record ReviewDto(
    UUID id,
    UUID weeklyCommitId,
    UUID reviewerId,
    ReviewState state,
    String comment,
    Instant reviewedAt) {

  public static ReviewDto from(ManagerReview review) {
    return new ReviewDto(
        review.getId(),
        review.getWeeklyCommitId(),
        review.getReviewerId(),
        review.getState(),
        review.getComment(),
        review.getReviewedAt());
  }
}
