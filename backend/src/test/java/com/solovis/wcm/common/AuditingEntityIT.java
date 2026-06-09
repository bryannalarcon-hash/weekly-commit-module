// AuditingEntityIT — Testcontainers integration test for JPA auditing.
// Uses the shared WcmPostgresContainer (one container for the whole IT suite, avoiding per-class
// start/stop races), persists an AppMeta, and asserts audit fields are auto-populated by JpaConfig.
package com.solovis.wcm.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.solovis.wcm.WcmPostgresContainer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

// Runs under the "test" profile with TestJwtConfig so the resource-server security chain has a
// JwtDecoder to start; no token is attached here, so auditing falls back to the "system" auditor.
@SpringBootTest
@ActiveProfiles("test")
@Import(com.solovis.wcm.common.TestJwtConfig.class)
class AuditingEntityIT {

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    WcmPostgresContainer.registerDatasource(registry);
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
