// ManagerReview — a manager's review of one WeeklyCommit; maps manager_review.
// state (UNREVIEWED/INCOMPLETE/REVIEWED) gates the FSM invariant RECONCILING->RECONCILED. Holds the
// reviewerId, an optional comment, and reviewedAt. Extends AbstractAuditingEntity. UNIQUE per
// weekly_commit (one review per commit — enforced by V7 + this table mapping).
package com.solovis.wcm.review;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
    name = "manager_review",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_manager_review_weekly_commit",
            columnNames = "weekly_commit_id"))
public class ManagerReview extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "weekly_commit_id", nullable = false)
  private UUID weeklyCommitId;

  @Column(name = "reviewer_id")
  private UUID reviewerId;

  @Enumerated(EnumType.STRING)
  @Column(name = "state", nullable = false, length = 20)
  private ReviewState state;

  @Column(name = "comment", length = 2000)
  private String comment;

  @Column(name = "reviewed_at")
  private Instant reviewedAt;

  @Builder
  private ManagerReview(
      UUID id,
      UUID weeklyCommitId,
      UUID reviewerId,
      ReviewState state,
      String comment,
      Instant reviewedAt) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.weeklyCommitId = weeklyCommitId;
    this.reviewerId = reviewerId;
    this.state = state == null ? ReviewState.UNREVIEWED : state;
    this.comment = comment;
    this.reviewedAt = reviewedAt;
  }

  /** Mark this review REVIEWED, stamping the time (FSM invariant on RECONCILING->RECONCILED). */
  public void markReviewed(Instant when) {
    this.state = ReviewState.REVIEWED;
    this.reviewedAt = when;
  }

  /** True when the manager has fully reviewed (gates the move to RECONCILED). */
  public boolean isReviewed() {
    return state == ReviewState.REVIEWED;
  }
}
