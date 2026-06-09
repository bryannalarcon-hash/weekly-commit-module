// AppMetaRepository — Spring Data JPA repository for AppMeta.
// Provides CRUD persistence used by the auditing integration test.
package com.solovis.wcm.common;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppMetaRepository extends JpaRepository<AppMeta, UUID> {}
