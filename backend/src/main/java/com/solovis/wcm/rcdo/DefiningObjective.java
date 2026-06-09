// DefiningObjective — second RCDO level; maps defining_objective. Child of RallyCry
// (rallyCryId NOT NULL), parent of Outcome. Carries title/description/date-window.
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
@Table(name = "defining_objective")
public class DefiningObjective extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "rally_cry_id", nullable = false)
  private UUID rallyCryId;

  @Column(name = "title", nullable = false, length = 200)
  private String title;

  @Column(name = "description", length = 2000)
  private String description;

  @Column(name = "start_date")
  private LocalDate startDate;

  @Column(name = "end_date")
  private LocalDate endDate;

  @Builder
  private DefiningObjective(
      UUID id,
      UUID rallyCryId,
      String title,
      String description,
      LocalDate startDate,
      LocalDate endDate) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.rallyCryId = rallyCryId;
    this.title = title;
    this.description = description;
    this.startDate = startDate;
    this.endDate = endDate;
  }
}
