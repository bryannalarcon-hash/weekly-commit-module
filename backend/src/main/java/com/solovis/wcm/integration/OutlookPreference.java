// OutlookPreference — a member's user-facing Outlook sync preference (U22), maps
// outlook_preference,
// UNIQUE(member_id). Holds whether locking a week creates a calendar event and the last successful
// sync time; the actual delegated token lives in GraphToken. Extends AbstractAuditingEntity.
// Mutated
// through OutlookService (upsert on the settings PUT).
package com.solovis.wcm.integration;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
    name = "outlook_preference",
    uniqueConstraints =
        @UniqueConstraint(name = "uq_outlook_preference_member", columnNames = "member_id"))
public class OutlookPreference extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "member_id", nullable = false)
  private UUID memberId;

  @Column(name = "create_event_on_lock", nullable = false)
  private boolean createEventOnLock;

  @Column(name = "last_sync_at")
  private Instant lastSyncAt;

  @Builder
  private OutlookPreference(UUID id, UUID memberId, boolean createEventOnLock, Instant lastSyncAt) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.memberId = memberId;
    this.createEventOnLock = createEventOnLock;
    this.lastSyncAt = lastSyncAt;
  }
}
