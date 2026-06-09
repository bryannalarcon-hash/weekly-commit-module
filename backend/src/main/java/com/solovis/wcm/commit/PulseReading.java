// PulseReading — a single 1..5 sentiment reading attached to a WeeklyCommit; maps pulse_reading.
// commentPrivate hides the comment from the manager when true. score is validated 1..5 (DB check +
// the factory). Extends AbstractAuditingEntity.
package com.solovis.wcm.commit;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "pulse_reading")
public class PulseReading extends AbstractAuditingEntity {

  private static final short MIN_SCORE = 1;
  private static final short MAX_SCORE = 5;

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "weekly_commit_id", nullable = false)
  private UUID weeklyCommitId;

  @Column(name = "score", nullable = false)
  private short score;

  @Column(name = "comment", length = 2000)
  private String comment;

  @Column(name = "comment_private", nullable = false)
  private boolean commentPrivate;

  @Builder
  private PulseReading(
      UUID id, UUID weeklyCommitId, short score, String comment, boolean commentPrivate) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.weeklyCommitId = weeklyCommitId;
    this.score = requireInRange(score);
    this.comment = comment;
    this.commentPrivate = commentPrivate;
  }

  private static short requireInRange(short score) {
    if (score < MIN_SCORE || score > MAX_SCORE) {
      throw new IllegalArgumentException("pulse score must be between 1 and 5, was " + score);
    }
    return score;
  }
}
