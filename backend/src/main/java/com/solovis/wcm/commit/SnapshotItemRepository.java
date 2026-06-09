// SnapshotItemRepository — Spring Data JPA repository for SnapshotItem.
// findBySnapshotId hydrates a CommitSnapshot's frozen plan rows.
package com.solovis.wcm.commit;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SnapshotItemRepository extends JpaRepository<SnapshotItem, UUID> {

  List<SnapshotItem> findBySnapshotId(UUID snapshotId);
}
