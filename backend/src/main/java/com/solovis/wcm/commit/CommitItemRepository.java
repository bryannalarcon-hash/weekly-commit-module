// CommitItemRepository — Spring Data JPA repository for CommitItem.
// findByWeeklyCommitId hydrates an aggregate's items; proves KTD5 (unlinked items persist).
package com.solovis.wcm.commit;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommitItemRepository extends JpaRepository<CommitItem, UUID> {

  List<CommitItem> findByWeeklyCommitId(UUID weeklyCommitId);
}
