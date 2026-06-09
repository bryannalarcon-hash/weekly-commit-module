// TeamRepository — Spring Data JPA repository for Team.
// Adds a name lookup used by the demo seeder for idempotent find-or-create.
package com.solovis.wcm.member;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<Team, UUID> {

  Optional<Team> findByName(String name);
}
