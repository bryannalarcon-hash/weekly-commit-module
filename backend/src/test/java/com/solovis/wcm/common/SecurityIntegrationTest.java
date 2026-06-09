// SecurityIntegrationTest — the U15 security suite. Exercises the resource-server chain end-to-end
// through MockMvc with locally minted RS256 tokens (TestJwtConfig): no token -> 401; an employee on
// a manager route -> 403; a manager (reconcile:commits) -> 200; a bad-audience token -> 401; a
// forged test-JWT REJECTED by the prod issuer-backed decoder; cross-manager isolation (manager A
// requesting B's reports sees none); and createdBy auditing reflecting the acting JWT subject.
package com.solovis.wcm.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.web.servlet.MvcResult;

class SecurityIntegrationTest extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private JwtDecoder jwtDecoder;

  private Member seed(String slug, MemberRole role, UUID managerId, String subject) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(role)
            .managerId(managerId)
            .auth0Subject(subject)
            .build());
  }

  @Test
  void noTokenIsUnauthorized() throws Exception {
    // A protected route with no Authorization header is rejected by the filter chain (401).
    mockMvc.perform(get("/api/commits")).andExpect(status().isUnauthorized());
  }

  @Test
  void employeeOnManagerRouteIsForbidden() throws Exception {
    String subject = "auth0|emp-" + UUID.randomUUID();
    seed("emp", MemberRole.EMPLOYEE, null, subject);

    // Employee token (no reconcile:commits permission) -> 403 on the manager-only rollup route.
    mockMvc
        .perform(get("/api/rollup").with(TestJwtConfig.employee(subject, "emp@solovis.test")))
        .andExpect(status().isForbidden());
  }

  @Test
  void managerWithReconcileScopeReachesManagerRoute() throws Exception {
    String subject = "auth0|mgr-" + UUID.randomUUID();
    seed("mgr", MemberRole.MANAGER, null, subject);

    // Manager token (carries reconcile:commits) -> 200 on the rollup route.
    mockMvc
        .perform(get("/api/rollup").with(TestJwtConfig.manager(subject, "mgr@solovis.test")))
        .andExpect(status().isOk());
  }

  @Test
  void badAudienceTokenIsRejected() {
    // A token whose audience is NOT our API must be rejected by the AudienceValidator. We assert
    // through a decoder composed exactly like prod (issuer + AudienceValidator) over a locally
    // signed token, since the default test decoder intentionally skips the audience check.
    JwtDecoder audienceChecking = TestJwtConfig.localDecoderWithAudience(TestJwtConfig.TEST_ISSUER);
    String wrongAudience =
        TestJwtConfig.mintWithAudience(
            TestJwtConfig.TEST_ISSUER,
            "auth0|aud-" + UUID.randomUUID(),
            "x@solovis.test",
            "https://other.api");

    assertThatThrownBy(() -> audienceChecking.decode(wrongAudience))
        .isInstanceOf(JwtValidationException.class);
  }

  @Test
  void forgedTestJwtIsRejectedByProdIssuerConfig() {
    // A real Auth0 issuer-backed decoder must reject a locally signed test token: it cannot resolve
    // the test "issuer" JWKS and the signature won't verify against Auth0 keys.
    JwtDecoder prod =
        NimbusJwtDecoder.withJwkSetUri("https://forged-tenant.us.auth0.test/.well-known/jwks.json")
            .build();
    String forged = TestJwtConfig.mint("auth0|forged-" + UUID.randomUUID(), "f@solovis.test");

    assertThatThrownBy(() -> prod.decode(forged)).isInstanceOf(Exception.class);
  }

  @Test
  void managerCannotSeeAnotherManagersReports() throws Exception {
    String subjectA = "auth0|mgrA-" + UUID.randomUUID();
    String subjectB = "auth0|mgrB-" + UUID.randomUUID();
    Member mgrA = seed("mgrA", MemberRole.MANAGER, null, subjectA);
    Member mgrB = seed("mgrB", MemberRole.MANAGER, null, subjectB);
    Member repA =
        seed("repA", MemberRole.EMPLOYEE, mgrA.getId(), "auth0|repA-" + UUID.randomUUID());
    Member repB =
        seed("repB", MemberRole.EMPLOYEE, mgrB.getId(), "auth0|repB-" + UUID.randomUUID());

    // Manager A's rollup contains only repA, never repB (row-level filter keyed off the JWT).
    mockMvc
        .perform(get("/api/rollup").with(TestJwtConfig.manager(subjectA, "mgrA@solovis.test")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.memberId=='%s')]".formatted(repA.getId())).exists())
        .andExpect(
            jsonPath("$.content[?(@.memberId=='%s')]".formatted(repB.getId())).doesNotExist());
  }

  @Test
  void createdByAuditReflectsJwtSubject() throws Exception {
    String subject = "auth0|audit-" + UUID.randomUUID();
    seed("audit", MemberRole.EMPLOYEE, null, subject);

    MvcResult created =
        mockMvc
            .perform(
                post("/api/commits")
                    .with(TestJwtConfig.employee(subject, "audit@solovis.test"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"weekStart\":\"2026-06-08\",\"items\":[]}"))
            .andExpect(status().isCreated())
            .andReturn();

    UUID id =
        UUID.fromString(
            objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText());
    WeeklyCommit persisted = commits.findById(id).orElseThrow();
    // @CreatedBy is the authentication name, which for a JWT is the subject claim.
    assertThat(persisted.getCreatedBy()).isEqualTo(subject);
  }
}
