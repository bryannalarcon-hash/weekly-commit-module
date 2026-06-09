// GraphConsentControllerIT — full-stack MockMvc tests for the delegated-Graph consent endpoints
// (U16/KTD7). /status + /connect are member-scoped (no JWT -> 401), resolving the acting member
// from
// the token; /connect 302-redirects to the Entra authorize URL carrying a SIGNED, opaque `state`
// (not the raw member id). A callback with a missing/forged state is rejected (400) BEFORE any
// token
// exchange — the security guard. The happy-path callback round-trip (which needs a token exchange)
// is
// covered separately by GraphConsentCallbackIT with a mocked GraphTokenService.
package com.solovis.wcm.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@TestPropertySource(
    properties = {
      "wcm.graph.client-id=test-entra-client",
      "wcm.graph.tenant=common",
      "wcm.graph.redirect-uri=http://localhost:8080/api/graph/callback",
      "wcm.graph.token-enc-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
    })
class GraphConsentControllerIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private GraphTokenRepository tokens;

  private Member member(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private RequestPostProcessor as(Member m) {
    return TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
  }

  @Test
  void statusIsFalseUntilATokenExistsThenTrue() throws Exception {
    Member m = member("graphStatus");

    mockMvc
        .perform(get("/api/graph/status").with(as(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.connected").value(false));

    tokens.saveAndFlush(
        GraphToken.builder()
            .memberId(m.getId())
            .accessTokenEnc("enc-access")
            .refreshTokenEnc("enc-refresh")
            .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
            .build());

    mockMvc
        .perform(get("/api/graph/status").with(as(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.connected").value(true));
  }

  @Test
  void connectRedirectsToEntraAuthorizeWithSignedOpaqueState() throws Exception {
    Member m = member("graphConnect");

    mockMvc
        .perform(get("/api/graph/connect").with(as(m)))
        .andExpect(status().isFound())
        .andExpect(
            header()
                .string(
                    "Location",
                    org.hamcrest.Matchers.containsString(
                        "login.microsoftonline.com/common/oauth2/v2.0/authorize")))
        .andExpect(
            header()
                .string(
                    "Location",
                    org.hamcrest.Matchers.containsString("client_id=test-entra-client")))
        // state is present...
        .andExpect(header().string("Location", org.hamcrest.Matchers.containsString("state=")))
        // ...but is SIGNED/opaque, NOT the raw member id (which would be forgeable).
        .andExpect(
            header()
                .string(
                    "Location",
                    org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("state=" + m.getId()))));
  }

  @Test
  void statusAndConnectRequireAuthentication() throws Exception {
    mockMvc.perform(get("/api/graph/status")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/graph/connect")).andExpect(status().isUnauthorized());
  }

  @Test
  void callbackWithoutStateIsRejected() throws Exception {
    // The callback is reachable WITHOUT a bearer token (permitAll), so an unauthenticated request
    // reaches the controller — but with no state it is rejected (400), never a 401/exchange.
    mockMvc
        .perform(get("/api/graph/callback").param("code", "any-auth-code"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void callbackWithForgedStateIsRejected() throws Exception {
    // An attacker-supplied state that was not signed by /connect must not bind a token to anyone.
    mockMvc
        .perform(
            get("/api/graph/callback")
                .param("code", "attacker-controlled-code")
                .param("state", UUID.randomUUID() + ".not-a-valid-signature"))
        .andExpect(status().isBadRequest());
  }
}
