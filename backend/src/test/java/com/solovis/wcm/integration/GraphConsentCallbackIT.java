// GraphConsentCallbackIT — end-to-end proof of the OAuth consent CALLBACK round-trip (U16/KTD7),
// the
// path the prior code could never reach (the callback used to require a JWT the browser redirect
// cannot carry, and ignored `state`). Here: an authenticated member hits /connect, we capture the
// SIGNED state from the redirect, then replay the tokenless browser GET
// /api/graph/callback?code=...
// &state=<that> — which must succeed (permitAll), derive the member FROM the state, and exchange
// the
// code for THAT member. GraphTokenService is mocked so no live Entra is called; this is isolated in
// its own class so the mock does not affect GraphConsentControllerIT's real /status assertions.
package com.solovis.wcm.integration;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

@TestPropertySource(
    properties = {
      "wcm.graph.client-id=test-entra-client",
      "wcm.graph.tenant=common",
      "wcm.graph.redirect-uri=http://localhost:8080/api/graph/callback",
      "wcm.graph.token-enc-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
    })
class GraphConsentCallbackIT extends AbstractWebIT {

  @Autowired private MemberRepository members;

  // Stub the exchange: the callback round-trip should NOT touch live Entra. We only assert it is
  // invoked for the member carried by the verified state.
  @MockBean private GraphTokenService tokenService;

  private Member member(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  @Test
  void connectThenCallbackCompletesWithoutABearerTokenAndAttributesTheMemberFromState()
      throws Exception {
    Member m = member("callbackOwner");
    when(tokenService.exchangeCode(eq(m.getId()), ArgumentMatchers.anyString())).thenReturn(null);

    // 1) Authenticated /connect -> grab the signed state minted into the authorize redirect.
    MvcResult connect =
        mockMvc
            .perform(
                get("/api/graph/connect")
                    .with(TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail())))
            .andExpect(status().isFound())
            .andReturn();
    String state = stateParam(connect.getResponse().getHeader("Location"));

    // 2) Tokenless browser GET to the callback (as Entra would redirect) -> succeeds, attributes m.
    mockMvc
        .perform(get("/api/graph/callback").param("code", "real-auth-code").param("state", state))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.connected").value(true))
        .andExpect(jsonPath("$.memberId").value(m.getId().toString()));

    // The exchange ran for the member the state was issued for — NOT for whoever hit the callback.
    verify(tokenService).exchangeCode(eq(m.getId()), eq("real-auth-code"));
  }

  /** Pull the (url-decoded) state query param out of the authorize redirect Location. */
  private static String stateParam(String location) {
    String query = URI.create(location).getQuery();
    for (String pair : query.split("&")) {
      int eq = pair.indexOf('=');
      if (eq > 0 && "state".equals(pair.substring(0, eq))) {
        return URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
      }
    }
    throw new IllegalStateException("no state param in: " + location);
  }
}
