// AuditingEntityIT — Testcontainers integration test for JPA auditing.
// Spins up real Postgres, persists an AppMeta, and asserts audit fields are auto-populated.
package com.solovis.wcm.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
class AuditingEntityIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.4")
          .withDatabaseName("wcm")
          .withUsername("wcm")
          .withPassword("wcm");

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @Autowired private AppMetaRepository appMetaRepository;

  @Test
  void persistsAuditMetadataOnSave() {
    AppMeta meta = new AppMeta();
    meta.setLabel("baseline-check");

    AppMeta saved = appMetaRepository.saveAndFlush(meta);

    assertThat(saved.getId()).isNotNull();
    assertThat(saved.getCreatedBy()).isEqualTo("system");
    assertThat(saved.getCreatedDate()).isNotNull();
    assertThat(saved.getLastModifiedBy()).isEqualTo("system");
    assertThat(saved.getLastModifiedDate()).isNotNull();
  }
}
