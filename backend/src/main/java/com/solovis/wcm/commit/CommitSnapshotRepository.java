// CommitSnapshotRepository — Spring Data JPA repository for CommitSnapshot.
// findByWeeklyCommitId resolves the frozen plan for reconciliation (one per commit, UNIQUE).
package com.solovis.wcm.commit;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommitSnapshotRepository extends JpaRepository<CommitSnapshot, UUID> {

  Optional<CommitSnapshot> findByWeeklyCommitId(UUID weeklyCommitId);
}
