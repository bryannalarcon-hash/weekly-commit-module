// Team — an org unit (GROUP or DEPARTMENT) that contains Members; maps the team table.
// parentTeamId (nullable) forms a self-referencing hierarchy. Extends AbstractAuditingEntity.
package com.solovis.wcm.member;

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
@Table(name = "team")
public class Team extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue): the seeder needs deterministic ids, and
  // Persistable.isNew() (not id-nullness) drives the INSERT-vs-merge choice. Defaults when absent.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "name", nullable = false, length = 160)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "type", nullable = false, length = 20)
  private TeamType type;

  @Column(name = "parent_team_id")
  private UUID parentTeamId;

  @Builder
  private Team(UUID id, String name, TeamType type, UUID parentTeamId) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.name = name;
    this.type = type;
    this.parentTeamId = parentTeamId;
  }

  /** True when this team has no parent (a top-level department/group root). */
  public boolean isRoot() {
    return parentTeamId == null;
  }
}
