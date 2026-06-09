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
          .withPassword("wcm")
          // Many cached @SpringBootTest contexts each hold a Hikari pool against this one shared
          // container; raise the server limit so the full suite never hits "too many clients".
          .withCommand("postgres", "-c", "max_connections=300");

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
    // Keep each test context's pool tiny so dozens of cached contexts don't exhaust the shared DB.
    registry.add("spring.datasource.hikari.maximum-pool-size", () -> "4");
    registry.add("spring.datasource.hikari.minimum-idle", () -> "0");
  }
}
