// WeeklyCommitRepository — Spring Data JPA repository for WeeklyCommit.
// Lookups enforce/exploit the UNIQUE(memberId, weekStart) shape and the manager-graph queries.
// findByMemberIdIn batch-loads a whole roll-up page's commits in ONE query (kills the N+1 the
// per-report findByMemberId would otherwise cause at the brief's 2000-record scale).
package com.solovis.wcm.commit;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyCommitRepository extends JpaRepository<WeeklyCommit, UUID> {

  Optional<WeeklyCommit> findByMemberIdAndWeekStart(UUID memberId, LocalDate weekStart);

  List<WeeklyCommit> findByMemberId(UUID memberId);

  /** Batch-load every commit owned by any of {@code memberIds} (one query for a roll-up page). */
  List<WeeklyCommit> findByMemberIdIn(Collection<UUID> memberIds);
}
