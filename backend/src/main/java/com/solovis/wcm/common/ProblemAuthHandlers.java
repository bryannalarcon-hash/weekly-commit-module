// ProblemAuthHandlers — RFC-7807 problem+json writers for SECURITY-FILTER-CHAIN denials, so a 401
// (no/invalid token) and a 403 (authenticated but lacking authority) carry the SAME application/
// problem+json body shape (a stable "code" + "type" URN) as the service-layer denials rendered by
// ApiExceptionHandler. Without these, the stateless resource-server chain returns an EMPTY body
// (findings #18/#19), inconsistent with the rest of the API. Wired into BOTH SecurityConfig (prod,
// @Profile !e2e) and E2eSecurityConfig via http.exceptionHandling(...). Status codes are unchanged;
// only the body is added. The handlers serialize a small fixed JSON map directly (no Jackson
// dependency on the filter path) and never leak the underlying exception message.
package com.solovis.wcm.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

public final class ProblemAuthHandlers {

  private static final String TYPE_PREFIX = "urn:wcm:problem:";

  private ProblemAuthHandlers() {}

  /**
   * AuthenticationEntryPoint for the resource-server chain: an unauthenticated request to a
   * protected route renders 401 problem+json (code "unauthorized") instead of an empty body.
   */
  public static AuthenticationEntryPoint unauthorizedEntryPoint() {
    return (HttpServletRequest request, HttpServletResponse response, AuthenticationException ex) ->
        writeProblem(
            response,
            HttpStatus.UNAUTHORIZED,
            "Unauthorized",
            "unauthorized",
            "authentication is required to access this resource");
  }

  /**
   * AccessDeniedHandler for the resource-server chain: an authenticated principal lacking the
   * required authority renders 403 problem+json (code "forbidden") instead of an empty body.
   */
  public static AccessDeniedHandler forbiddenHandler() {
    return (HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex) ->
        writeProblem(
            response,
            HttpStatus.FORBIDDEN,
            "Forbidden",
            "forbidden",
            "you do not have permission to access this resource");
  }

  private static void writeProblem(
      HttpServletResponse response, HttpStatus status, String title, String code, String detail)
      throws IOException {
    response.setStatus(status.value());
    // Set the Content-Type WITHOUT a charset suffix so the header is exactly
    // "application/problem+json", matching the ProblemDetail responses ApiExceptionHandler emits.
    // The body is written as raw UTF-8 bytes (no servlet writer, which would append a charset).
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    String body =
        "{\"type\":\""
            + TYPE_PREFIX
            + code
            + "\",\"title\":\""
            + title
            + "\",\"status\":"
            + status.value()
            + ",\"detail\":\""
            + detail
            + "\",\"code\":\""
            + code
            + "\"}";
    response.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
  }
}
