// GraphTokenRepository — Spring Data JPA repository for GraphToken (U16).
// findByMemberId resolves a member's single delegated-Graph token (the store is one-per-member).
package com.solovis.wcm.integration;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GraphTokenRepository extends JpaRepository<GraphToken, UUID> {

  Optional<GraphToken> findByMemberId(UUID memberId);
}
