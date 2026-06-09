// RallyCryRepository — Spring Data JPA repository for RallyCry (RCDO root).
// Aggregated behind RcdoRepository; direct CRUD for the strategy tree's top level.
package com.solovis.wcm.rcdo;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RallyCryRepository extends JpaRepository<RallyCry, UUID> {}
