// SupportingOutcomeRepository — Spring Data JPA repository for SupportingOutcome (RCDO leaf).
// findByOutcomeId walks Outcome -> its leaves; findByOwnerId resolves a member's owned outcomes.
package com.solovis.wcm.rcdo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportingOutcomeRepository extends JpaRepository<SupportingOutcome, UUID> {

  List<SupportingOutcome> findByOutcomeId(UUID outcomeId);

  List<SupportingOutcome> findByOwnerId(UUID ownerId);
}
