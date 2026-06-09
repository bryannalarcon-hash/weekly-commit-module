// GraphToken — a member's delegated Microsoft Graph token, stored ENCRYPTED at rest (U16/KTD7);
// maps graph_token, UNIQUE(member_id). accessTokenEnc/refreshTokenEnc hold AES-GCM ciphertext (the
// plaintext tokens are never persisted); expiresAt drives refresh-before-expiry in
// GraphTokenService.
// Extends AbstractAuditingEntity. Mutated only through GraphTokenService (encrypt/decrypt +
// refresh).
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
    name = "graph_token",
    uniqueConstraints =
        @UniqueConstraint(name = "uq_graph_token_member", columnNames = "member_id"))
public class GraphToken extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "member_id", nullable = false)
  private UUID memberId;

  /** AES-GCM ciphertext of the Graph access token (never plaintext). */
  @Column(name = "access_token_enc", nullable = false, columnDefinition = "text")
  private String accessTokenEnc;

  /** AES-GCM ciphertext of the refresh token, when the consent included offline_access. */
  @Column(name = "refresh_token_enc", columnDefinition = "text")
  private String refreshTokenEnc;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Builder
  private GraphToken(
      UUID id, UUID memberId, String accessTokenEnc, String refreshTokenEnc, Instant expiresAt) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.memberId = memberId;
    this.accessTokenEnc = accessTokenEnc;
    this.refreshTokenEnc = refreshTokenEnc;
    this.expiresAt = expiresAt;
  }

  /**
   * True when the access token is at/after {@code asOf} minus a refresh skew handled by the caller.
   */
  public boolean isExpiredAt(Instant asOf) {
    return !expiresAt.isAfter(asOf);
  }
}
