// CommitSnapshot — the immutable planned set frozen at LOCK for one WeeklyCommit; maps
// commit_snapshot (KTD4). One per weekly_commit (UNIQUE). Holds capturedAt and the frozen
// SnapshotItems (transient working set; children persist via SnapshotItemRepository).
package com.solovis.wcm.commit;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "commit_snapshot")
public class CommitSnapshot extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "weekly_commit_id", nullable = false)
  private UUID weeklyCommitId;

  @Column(name = "captured_at", nullable = false)
  private Instant capturedAt;

  /** Transient working set of frozen items; children persist via SnapshotItemRepository. */
  @Transient private final List<SnapshotItem> items = new ArrayList<>();

  @Builder
  private CommitSnapshot(UUID id, UUID weeklyCommitId, Instant capturedAt) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.weeklyCommitId = weeklyCommitId;
    this.capturedAt = capturedAt;
  }

  public void addItem(SnapshotItem item) {
    items.add(item);
  }

  /** The frozen plan items, unmodifiable — callers cannot mutate the snapshot after capture. */
  public List<SnapshotItem> getItems() {
    return Collections.unmodifiableList(items);
  }
}
