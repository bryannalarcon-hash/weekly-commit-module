// SnapshotItem — one frozen planned line inside a CommitSnapshot; maps snapshot_item (KTD4).
// Captures text/supportingOutcomeId/chessTier ONLY — never status — so the plan stays immutable
// while live CommitItem.status carries the actual. Also captures commitItemId: a capture-time copy
// of the source CommitItem's id, giving U13 reconciliation a deterministic plan↔actual join key
// (text/link/tier are non-unique, so they cannot pair frozen plan lines to live items reliably).
// Extends AbstractAuditingEntity.
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
@Table(name = "snapshot_item")
public class SnapshotItem extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "snapshot_id", nullable = false)
  private UUID snapshotId;

  // Capture-time copy of the source CommitItem.id — the deterministic join key for U13
  // reconciliation (frozen plan line -> live CommitItem.status). Not a live FK reference; the
  // value is frozen at capture and never re-resolved, so the plan stays immutable.
  @Column(name = "commit_item_id")
  private UUID commitItemId;

  @Column(name = "text", nullable = false, length = 1000)
  private String text;

  @Column(name = "supporting_outcome_id")
  private UUID supportingOutcomeId;

  @Enumerated(EnumType.STRING)
  @Column(name = "chess_tier", length = 10)
  private ChessTier chessTier;

  @Builder
  private SnapshotItem(
      UUID id,
      UUID snapshotId,
      UUID commitItemId,
      String text,
      UUID supportingOutcomeId,
      ChessTier chessTier) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.snapshotId = snapshotId;
    this.commitItemId = commitItemId;
    this.text = text;
    this.supportingOutcomeId = supportingOutcomeId;
    this.chessTier = chessTier;
  }

  /**
   * Freeze a live CommitItem's PLAN fields (text/link/tier) — never its status (KTD4). Also
   * captures {@code source.getId()} into commitItemId as the deterministic join key for U13
   * reconciliation.
   */
  public static SnapshotItem freeze(UUID snapshotId, CommitItem source) {
    return SnapshotItem.builder()
        .snapshotId(snapshotId)
        .commitItemId(source.getId())
        .text(source.getText())
        .supportingOutcomeId(source.getSupportingOutcomeId())
        .chessTier(source.getChessTier())
        .build();
  }
}
