// AbstractPersistenceIT — shared @DataJpaTest base for the domain/persistence integration tests.
// Uses the process-wide WcmPostgresContainer (real postgres:16.4) with the real datasource
// (replace = NONE) so Flyway V1..V5 apply and Hibernate `validate` runs against the actual schema.
// Imports JpaConfig so JPA auditing is active (@CreatedBy populates the NOT NULL created_by
// column).
// Subclasses add repositories and assert real DB behavior (uniqueness, NOT NULL, KTD5 nullable
// link).
package com.solovis.wcm;

import com.solovis.wcm.common.JpaConfig;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@DataJpaTest
@Import(JpaConfig.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
public abstract class AbstractPersistenceIT {

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    WcmPostgresContainer.registerDatasource(registry);
  }
}
