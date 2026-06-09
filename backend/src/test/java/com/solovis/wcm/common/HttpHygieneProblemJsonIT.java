// HttpHygieneProblemJsonIT — regression suite for the HTTP-hygiene fix wave (findings #6/#10/#17/
// #18/#19/#21). Proves error responses are consistent RFC-7807 application/problem+json: an
// unknown route reached by an AUTHENTICATED member -> 404 (code "not_found"); a wrong HTTP method
// on
// a real route -> 405 (code "method_not_allowed"); an UNAUTHENTICATED protected route -> 401 with a
// problem+json BODY (code "unauthorized"), no longer an empty 403; an authenticated employee on a
// manager-only route -> 403 with a problem+json body (code "forbidden"); and the Graph callback,
// when GRAPH_TOKEN_ENC_KEY is unset, -> 503 (code "graph_not_configured") rather than a bare 403.
// Runs on AbstractWebIT (full stack + local RS256 JWTs); no commit is created so no weekStart/
// SupportingOutcome fixture is needed.
package com.solovis.wcm.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class HttpHygieneProblemJsonIT extends AbstractWebIT {

  private static final MediaType PROBLEM_JSON = MediaType.APPLICATION_PROBLEM_JSON;

  @Autowired private MemberRepository members;

  private Member seed(String slug, MemberRole role) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(role)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  @Test
  void unknownRouteAsAuthenticatedMemberIs404ProblemJson() throws Exception {
    Member m = seed("emp404", MemberRole.EMPLOYEE);
    // An authenticated member hitting a route that maps to NO handler must get a clean 404
    // problem+json, not the stateless chain's misleading empty 403.
    mockMvc
        .perform(
            get("/api/this-route-does-not-exist")
                .with(TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail())))
        .andExpect(status().isNotFound())
        .andExpect(header().string("Content-Type", PROBLEM_JSON.toString()))
        .andExpect(jsonPath("$.code").value("not_found"));
  }

  @Test
  void wrongMethodOnRealRouteIs405ProblemJson() throws Exception {
    Member m = seed("emp405", MemberRole.EMPLOYEE);
    // /api/commits supports GET/POST but not DELETE -> 405 method_not_allowed, not an empty 403.
    mockMvc
        .perform(
            delete("/api/commits").with(TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail())))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(header().string("Content-Type", PROBLEM_JSON.toString()))
        .andExpect(jsonPath("$.code").value("method_not_allowed"));
  }

  @Test
  void unauthenticatedProtectedRouteIs401WithProblemJsonBody() throws Exception {
    // No bearer token on a protected route: still 401, but now carries a problem+json body with a
    // stable "code" (was an empty body, inconsistent with service-layer denials).
    mockMvc
        .perform(get("/api/commits"))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string("Content-Type", PROBLEM_JSON.toString()))
        .andExpect(jsonPath("$.code").value("unauthorized"));
  }

  @Test
  void employeeOnManagerRouteIs403WithProblemJsonBody() throws Exception {
    Member m = seed("emp403", MemberRole.EMPLOYEE);
    // An authenticated employee lacking SCOPE_reconcile:commits on a manager route: 403 with a
    // problem+json body (code "forbidden"), no longer an empty 403.
    mockMvc
        .perform(get("/api/rollup").with(TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail())))
        .andExpect(status().isForbidden())
        .andExpect(header().string("Content-Type", PROBLEM_JSON.toString()))
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void reviewQueueTrailingSlashIsForbiddenForEmployee() throws Exception {
    Member m = seed("empTrailing", MemberRole.EMPLOYEE);
    // The trailing-slash variant of a manager route must be guarded identically to the exact path
    // (matcher now covers "/api/review-queue/**"), so an employee gets 403 — not a 404 leaking
    // through because the security matcher missed the slash variant.
    mockMvc
        .perform(
            get("/api/review-queue/")
                .with(TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail())))
        .andExpect(status().isForbidden())
        .andExpect(header().string("Content-Type", PROBLEM_JSON.toString()))
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void errorDispatchRendersProblemJson() throws Exception {
    Member m = seed("errProblem", MemberRole.EMPLOYEE);
    // The container /error path (Boot's whitelabel by default) now renders RFC-7807 problem+json
    // via
    // ProblemErrorController, so EVERY error surface is consistent. A direct authenticated hit with
    // no servlet error attributes defaults to 500 with a stable "code".
    mockMvc
        .perform(get("/error").with(TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail())))
        .andExpect(header().string("Content-Type", PROBLEM_JSON.toString()))
        .andExpect(jsonPath("$.code").value("error"));
  }

  @Test
  void graphCallbackWithoutEncKeyIs503GraphNotConfigured() throws Exception {
    // No wcm.graph.token-enc-key configured under the test profile (AbstractWebIT sets none), so
    // the
    // consent callback's requireKey() must surface as a CLEAR 503 graph_not_configured, not a bare
    // 403/empty. The callback is permitAll, so an unauthenticated request reaches the controller.
    mockMvc
        .perform(get("/api/graph/callback").param("code", "any-code").param("state", "any-state"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(header().string("Content-Type", PROBLEM_JSON.toString()))
        .andExpect(jsonPath("$.code").value("graph_not_configured"));
  }
}
