// ApiExceptionHandler — central @RestControllerAdvice translating domain/web exceptions into
// RFC-7807 ProblemDetail responses (KTD9) for every controller. Maps: unresolved member -> 401,
// forbidden/ownership -> 403, not-found -> 404, illegal lifecycle transition -> 409, a persistence
// constraint collision (e.g. duplicate member+week) -> 409, unprocessable precondition (unlinked
// submit) -> 422, an unverifiable Graph consent state -> 400, bean-validation failures -> 400, an
// unreadable/malformed request body -> 400, an unsupported request media type -> 415. Each
// ProblemDetail carries a stable "type" URN
// and a "code" property so the FE can branch on errors. The data-integrity handler is the backstop
// that guarantees no DB constraint violation ever leaks as a raw Spring 500. The body-parse and
// media-type handlers keep Spring's built-in MVC exceptions from escaping the advice and surfacing
// as a bare 403/empty response via the stateless security chain's /error dispatch.
package com.solovis.wcm.common;

import com.solovis.wcm.commit.IllegalTransitionException;
import com.solovis.wcm.integration.InvalidConsentStateException;
import java.net.URI;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

  private static final String TYPE_PREFIX = "urn:wcm:problem:";

  @ExceptionHandler(UnresolvedMemberException.class)
  public ProblemDetail onUnresolvedMember(UnresolvedMemberException ex) {
    return problem(HttpStatus.UNAUTHORIZED, "Unauthorized", "unauthorized", ex.getMessage());
  }

  @ExceptionHandler(ForbiddenException.class)
  public ProblemDetail onForbidden(ForbiddenException ex) {
    return problem(HttpStatus.FORBIDDEN, "Forbidden", "forbidden", ex.getMessage());
  }

  @ExceptionHandler(ResourceNotFoundException.class)
  public ProblemDetail onNotFound(ResourceNotFoundException ex) {
    return problem(HttpStatus.NOT_FOUND, "Not Found", "not_found", ex.getMessage());
  }

  @ExceptionHandler(IllegalTransitionException.class)
  public ProblemDetail onIllegalTransition(IllegalTransitionException ex) {
    ProblemDetail pd =
        problem(HttpStatus.CONFLICT, "Conflict", "illegal_transition", ex.getMessage());
    if (ex.getFrom() != null) {
      pd.setProperty("from", ex.getFrom().name());
    }
    if (ex.getTo() != null) {
      pd.setProperty("to", ex.getTo().name());
    }
    return pd;
  }

  @ExceptionHandler(UnprocessableEntityException.class)
  public ProblemDetail onUnprocessable(UnprocessableEntityException ex) {
    return problem(
        HttpStatus.UNPROCESSABLE_ENTITY, "Unprocessable Entity", "unprocessable", ex.getMessage());
  }

  /**
   * An operation with a lifecycle-state precondition was attempted in the wrong state — e.g.
   * reviewing a never-submitted DRAFT that has no frozen plan. Renders 409 with the stable {@code
   * illegal_state} code. Distinct from {@code illegal_transition}, which guards FSM moves; this
   * guards a non-transition operation that still requires the commit be LOCKED or later.
   */
  @ExceptionHandler(IllegalCommitStateException.class)
  public ProblemDetail onIllegalCommitState(IllegalCommitStateException ex) {
    return problem(HttpStatus.CONFLICT, "Conflict", "illegal_state", ex.getMessage());
  }

  /**
   * Backstop for any persistence constraint collision (unique/FK/not-null) — e.g. two commits for
   * the same member+week. Renders 409 with a stable code instead of letting Spring surface a raw
   * 500; the detail is generic (no SQL leaked) so internals stay private.
   */
  @ExceptionHandler(DataIntegrityViolationException.class)
  public ProblemDetail onDataIntegrity(DataIntegrityViolationException ex) {
    return problem(
        HttpStatus.CONFLICT,
        "Conflict",
        "constraint_violation",
        "the request conflicts with an existing record");
  }

  /**
   * A consent callback presented an OAuth {@code state} that failed verification (missing,
   * tampered, or expired). Renders 400: this is a rejected/forged request, not an authenticated
   * principal lacking rights — surfacing it as 401/403 would wrongly imply a login problem.
   */
  @ExceptionHandler(InvalidConsentStateException.class)
  public ProblemDetail onInvalidConsentState(InvalidConsentStateException ex) {
    return problem(HttpStatus.BAD_REQUEST, "Bad Request", "invalid_consent_state", ex.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ProblemDetail onValidation(MethodArgumentNotValidException ex) {
    String detail =
        ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + " " + fe.getDefaultMessage())
            .findFirst()
            .orElse("request validation failed");
    return problem(HttpStatus.BAD_REQUEST, "Bad Request", "validation_failed", detail);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ProblemDetail onIllegalArgument(IllegalArgumentException ex) {
    return problem(HttpStatus.BAD_REQUEST, "Bad Request", "bad_request", ex.getMessage());
  }

  /**
   * An unreadable/unparseable request body — invalid JSON, a wrong-typed/unknown enum literal, or
   * an empty body where one is required. Renders 400 with a stable {@code malformed_request} code
   * and a generic detail (the raw parser message can leak type/field internals, so it is not
   * echoed). This is the message-not-readable path: without this handler the exception escapes the
   * advice and the stateless security chain's /error dispatch surfaces it as a misleading bare 403
   * empty response.
   */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ProblemDetail onUnreadableBody(HttpMessageNotReadableException ex) {
    return problem(
        HttpStatus.BAD_REQUEST,
        "Bad Request",
        "malformed_request",
        "the request body could not be read or is malformed");
  }

  /**
   * The request carried an unsupported {@code Content-Type} (e.g. text/plain on a JSON route).
   * Renders 415 problem+json with a stable code instead of letting the built-in MVC exception
   * escape to the /error dispatch and surface as a bare 403.
   */
  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ProblemDetail onUnsupportedMediaType(HttpMediaTypeNotSupportedException ex) {
    return problem(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        "Unsupported Media Type",
        "unsupported_media_type",
        "the request Content-Type is not supported by this endpoint");
  }

  private static ProblemDetail problem(
      HttpStatus status, String title, String code, String detail) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
    pd.setTitle(title);
    pd.setType(URI.create(TYPE_PREFIX + code));
    pd.setProperty("code", code);
    return pd;
  }
}
