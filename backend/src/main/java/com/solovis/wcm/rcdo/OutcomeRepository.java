// OutcomeRepository — Spring Data JPA repository for Outcome.
// findByDefiningObjectiveId walks DefiningObjective -> its outcomes for the RCDO tree query.
package com.solovis.wcm.rcdo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutcomeRepository extends JpaRepository<Outcome, UUID> {

  List<Outcome> findByDefiningObjectiveId(UUID definingObjectiveId);
}
