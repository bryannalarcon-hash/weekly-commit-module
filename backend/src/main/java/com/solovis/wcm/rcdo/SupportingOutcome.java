// SupportingOutcome — RCDO leaf; maps supporting_outcome. Child of Outcome (outcomeId NOT NULL)
// and the link target of a CommitItem. ownerId references the owning Member. Carries title/window.
package com.solovis.wcm.rcdo;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "supporting_outcome")
public class SupportingOutcome extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "outcome_id", nullable = false)
  private UUID outcomeId;

  @Column(name = "owner_id")
  private UUID ownerId;

  @Column(name = "title", nullable = false, length = 200)
  private String title;

  @Column(name = "description", length = 2000)
  private String description;

  @Column(name = "start_date")
  private LocalDate startDate;

  @Column(name = "end_date")
  private LocalDate endDate;

  @Builder
  private SupportingOutcome(
      UUID id,
      UUID outcomeId,
      UUID ownerId,
      String title,
      String description,
      LocalDate startDate,
      LocalDate endDate) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.outcomeId = outcomeId;
    this.ownerId = ownerId;
    this.title = title;
    this.description = description;
    this.startDate = startDate;
    this.endDate = endDate;
  }
}
