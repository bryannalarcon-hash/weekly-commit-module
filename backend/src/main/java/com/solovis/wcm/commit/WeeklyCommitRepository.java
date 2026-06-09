// WeeklyCommitRepository — Spring Data JPA repository for WeeklyCommit.
// Lookups enforce/exploit the UNIQUE(memberId, weekStart) shape and the manager-graph queries.
package com.solovis.wcm.commit;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyCommitRepository extends JpaRepository<WeeklyCommit, UUID> {

  Optional<WeeklyCommit> findByMemberIdAndWeekStart(UUID memberId, LocalDate weekStart);

  List<WeeklyCommit> findByMemberId(UUID memberId);
}
