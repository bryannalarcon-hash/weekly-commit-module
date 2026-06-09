// WcmPostgresContainer — process-wide singleton postgres:16.4 Testcontainer for all integration
// tests. Started once in a static initializer and NEVER stopped (the JVM/Ryuk reaps it at exit), so
// every IT class shares one container — avoiding the per-class start/stop races that caused
// connection-refused failures. registerDatasource() wires Spring's datasource + Flyway to it.
package com.solovis.wcm;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.PostgreSQLContainer;

public final class WcmPostgresContainer {

  public static final PostgreSQLContainer<?> INSTANCE =
      new PostgreSQLContainer<>("postgres:16.4")
          .withDatabaseName("wcm")
          .withUsername("wcm")
          .withPassword("wcm");

  static {
    INSTANCE.start();
  }

  private WcmPostgresContainer() {}

  /**
   * Point Spring's datasource + Flyway at the shared container (call from @DynamicPropertySource).
   */
  public static void registerDatasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", INSTANCE::getJdbcUrl);
    registry.add("spring.datasource.username", INSTANCE::getUsername);
    registry.add("spring.datasource.password", INSTANCE::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
  }
}
