// MemberRepository — Spring Data JPA repository for Member.
// Adds lookups by auth0Subject (JIT provisioning) and managerId (manager-graph roll-up).
package com.solovis.wcm.member;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, UUID> {

  Optional<Member> findByAuth0Subject(String auth0Subject);

  Optional<Member> findByEmail(String email);

  List<Member> findByManagerId(UUID managerId);
}
