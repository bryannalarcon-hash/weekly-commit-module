// ProblemErrorController — renders the Spring container's /error dispatch as RFC-7807
// application/problem+json (code "error"), replacing Boot's whitelabel BasicErrorController so that
// EVERY error surface (including filter-level errors and forwards to /error) matches the
// problem+json shape ApiExceptionHandler/ProblemAuthHandlers emit. It reads the real error status
// from the servlet error attributes (defaulting to 500) and never echoes the underlying message, so
// no internals leak. Controller-thrown exceptions still go through ApiExceptionHandler first; this
// is the backstop for anything that reaches the container error path.
package com.solovis.wcm.common;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProblemErrorController implements ErrorController {

  private static final String TYPE_PREFIX = "urn:wcm:problem:";

  @RequestMapping("${server.error.path:${error.path:/error}}")
  public ProblemDetail handleError(HttpServletRequest request) {
    HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
    Object code = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
    if (code instanceof Integer statusCode) {
      HttpStatus resolved = HttpStatus.resolve(statusCode);
      if (resolved != null) {
        status = resolved;
      }
    }
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, "an unexpected error occurred");
    pd.setTitle(status.getReasonPhrase());
    pd.setType(URI.create(TYPE_PREFIX + "error"));
    pd.setProperty("code", "error");
    return pd;
  }
}
