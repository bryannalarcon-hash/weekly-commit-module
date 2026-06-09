// AbstractWebIT — shared @SpringBootTest + MockMvc base for the web-layer controller tests
// (U11-U15).
// Boots the FULL application context (controllers, services, JPA, Flyway, the event seam, the
// JWT-backed CurrentMemberProvider + the resource-server security chain) against the process-wide
// WcmPostgresContainer, so MockMvc exercises the real stack end-to-end. Runs under the "test"
// profile and imports TestJwtConfig (local RS256 keypair + decoder), so subclasses authenticate by
// attaching a locally minted bearer token whose subject matches a seeded Member's auth0Subject
// (TestJwtConfig.bearer/employee/manager) instead of the removed X-Debug-Member seam.
package com.solovis.wcm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solovis.wcm.common.TestJwtConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

// @Transactional rolls each test back: MockMvc runs in-process, so the controllers' transactions
// join the test's transaction (propagation REQUIRED) and are reverted at test end. This keeps the
// shared WcmPostgresContainer clean for the count-sensitive DemoSeederIT (which assumes every other
// IT is rolled back) and isolates web tests from each other.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestJwtConfig.class)
@Transactional
public abstract class AbstractWebIT {

  @Autowired protected MockMvc mockMvc;
  @Autowired protected ObjectMapper objectMapper;

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    WcmPostgresContainer.registerDatasource(registry);
  }
}
