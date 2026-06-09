// CommitItem — one line of a WeeklyCommit; maps commit_item. KTD5: supportingOutcomeId is NULLABLE
// (an unlinked draft item persists; the DRAFT->LOCKED guard requires it, not the column). status is
// the live ACTUAL; chessTier the priority; carriedFromItemId the lineage to the prior week's item.
package com.solovis.wcm.commit;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "commit_item")
public class CommitItem extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "weekly_commit_id", nullable = false)
  private UUID weeklyCommitId;

  @Column(name = "text", nullable = false, length = 1000)
  private String text;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 20)
  private CommitItemStatus status;

  /** KTD5 — nullable at the column; the lock guard enforces presence, not the schema. */
  @Column(name = "supporting_outcome_id")
  private UUID supportingOutcomeId;

  @Enumerated(EnumType.STRING)
  @Column(name = "chess_tier", length = 10)
  private ChessTier chessTier;

  @Column(name = "carried_from_item_id")
  private UUID carriedFromItemId;

  @Column(name = "outlook_event_id", length = 255)
  private String outlookEventId;

  @Builder
  private CommitItem(
      UUID id,
      UUID weeklyCommitId,
      String text,
      CommitItemStatus status,
      UUID supportingOutcomeId,
      ChessTier chessTier,
      UUID carriedFromItemId,
      String outlookEventId) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.weeklyCommitId = weeklyCommitId;
    this.text = text;
    this.status = status == null ? CommitItemStatus.OPEN : status;
    this.supportingOutcomeId = supportingOutcomeId;
    this.chessTier = chessTier;
    this.carriedFromItemId = carriedFromItemId;
    this.outlookEventId = outlookEventId;
  }

  /** KTD5 guard input: an item is linked when it references a SupportingOutcome. */
  public boolean isLinked() {
    return supportingOutcomeId != null;
  }

  /**
   * Carry-forward predicate: an item rolls into next week when it is UNFINISHED — either explicitly
   * INCOMPLETE, or still OPEN (never resolved during reconcile, and from the LOCKED escape hatch
   * every item is still OPEN). This agrees with the reconciliation diff, which flags OPEN as
   * INCOMPLETE, so nothing the user sees as unfinished is silently dropped (FR3). COMPLETE and
   * already CARRIED_FORWARD items are excluded.
   */
  public boolean isUnfinished() {
    return status == CommitItemStatus.OPEN || status == CommitItemStatus.INCOMPLETE;
  }
}
