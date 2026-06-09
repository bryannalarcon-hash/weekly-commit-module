// WeeklyCommit — the weekly-commit aggregate root; maps weekly_commit. UNIQUE(memberId, weekStart).
// Holds lifecycleState (driven only via LifecycleService) and review bookkeeping. `items` is a
// transient working set the FSM operates on (children persist via CommitItemRepository, not
// cascade).
package com.solovis.wcm.commit;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "weekly_commit")
public class WeeklyCommit extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "member_id", nullable = false)
  private UUID memberId;

  @Column(name = "week_start", nullable = false)
  private LocalDate weekStart;

  @Enumerated(EnumType.STRING)
  @Column(name = "lifecycle_state", nullable = false, length = 20)
  private LifecycleState lifecycleState;

  @Column(name = "submitted_at")
  private Instant submittedAt;

  @Column(name = "reviewer_id")
  private UUID reviewerId;

  @Column(name = "reviewed_at")
  private Instant reviewedAt;

  /**
   * Transient working set of this commit's items for the FSM/guards. Not a JPA association: items
   * persist via CommitItemRepository, keeping the schema flat and `ddl-auto: validate` honest. The
   * Lombok getter is suppressed; getItems() returns an unmodifiable view (callers use addItem).
   */
  @Transient
  @Getter(AccessLevel.NONE)
  private final List<CommitItem> items = new ArrayList<>();

  @Builder
  private WeeklyCommit(
      UUID id,
      UUID memberId,
      LocalDate weekStart,
      LifecycleState lifecycleState,
      Instant submittedAt,
      UUID reviewerId,
      Instant reviewedAt) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.memberId = memberId;
    this.weekStart = weekStart;
    this.lifecycleState = lifecycleState == null ? LifecycleState.DRAFT : lifecycleState;
    this.submittedAt = submittedAt;
    this.reviewerId = reviewerId;
    this.reviewedAt = reviewedAt;
  }

  /**
   * The working-set items, unmodifiable — mutate only via addItem (defensive against EI_EXPOSE).
   */
  public List<CommitItem> getItems() {
    return Collections.unmodifiableList(items);
  }

  /** Attach an item to the in-memory working set (FSM operates on this collection). */
  public WeeklyCommit addItem(CommitItem item) {
    items.add(item);
    return this;
  }

  /** True when every working-set item is linked to a SupportingOutcome (DRAFT->LOCKED guard). */
  public boolean allItemsLinked() {
    return items.stream().allMatch(CommitItem::isLinked);
  }
}
