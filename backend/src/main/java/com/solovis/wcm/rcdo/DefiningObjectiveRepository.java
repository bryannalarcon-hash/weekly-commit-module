// DefiningObjectiveRepository — Spring Data JPA repository for DefiningObjective.
// findByRallyCryId walks RallyCry -> its objectives for the RCDO tree query.
package com.solovis.wcm.rcdo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DefiningObjectiveRepository extends JpaRepository<DefiningObjective, UUID> {

  List<DefiningObjective> findByRallyCryId(UUID rallyCryId);
}
