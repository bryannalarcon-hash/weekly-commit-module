// Member — a person who authors weekly commits; maps the member table.
// Identity binds to auth0Subject (unique) for JIT provisioning; managerId self-FK forms the
// manager graph used by roll-up/authz. Extends AbstractAuditingEntity. email is unique.
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
@Table(name = "member")
public class Member extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "email", nullable = false, length = 254)
  private String email;

  @Column(name = "display_name", nullable = false, length = 160)
  private String displayName;

  @Column(name = "title", length = 160)
  private String title;

  @Column(name = "manager_id")
  private UUID managerId;

  @Enumerated(EnumType.STRING)
  @Column(name = "role", nullable = false, length = 20)
  private MemberRole role;

  @Column(name = "auth0_subject", nullable = false, length = 255)
  private String auth0Subject;

  @Column(name = "team_id")
  private UUID teamId;

  @Builder
  private Member(
      UUID id,
      String email,
      String displayName,
      String title,
      UUID managerId,
      MemberRole role,
      String auth0Subject,
      UUID teamId) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.email = email;
    this.displayName = displayName;
    this.title = title;
    this.managerId = managerId;
    this.role = role;
    this.auth0Subject = auth0Subject;
    this.teamId = teamId;
  }

  /** True when this member has no manager (a top-of-graph executive). */
  public boolean isTopLevel() {
    return managerId == null;
  }

  /** True when this member can act as a reviewer (MANAGER role). */
  public boolean canReview() {
    return role == MemberRole.MANAGER;
  }
}
