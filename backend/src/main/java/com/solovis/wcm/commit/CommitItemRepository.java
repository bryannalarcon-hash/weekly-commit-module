// CommitItemRepository — Spring Data JPA repository for CommitItem.
// findByWeeklyCommitId hydrates an aggregate's items; proves KTD5 (unlinked items persist).
// findByWeeklyCommitIdIn batch-loads all items for a set of commits in ONE query — the roll-up
// read model uses it to avoid a per-commit round trip at the 2000-record scale.
package com.solovis.wcm.commit;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommitItemRepository extends JpaRepository<CommitItem, UUID> {

  List<CommitItem> findByWeeklyCommitId(UUID weeklyCommitId);

  /** Batch-load every item belonging to any of {@code commitIds} (one query for a roll-up page). */
  List<CommitItem> findByWeeklyCommitIdIn(Collection<UUID> commitIds);
}
