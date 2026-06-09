// PulseReadingRepository — Spring Data JPA repository for PulseReading.
// findByWeeklyCommitId fetches the reading(s) attached to a weekly commit.
package com.solovis.wcm.commit;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PulseReadingRepository extends JpaRepository<PulseReading, UUID> {

  List<PulseReading> findByWeeklyCommitId(UUID weeklyCommitId);
}
