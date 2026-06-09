// UnprocessableEntityException — the request is well-formed but violates a domain precondition that
// is not a state-machine conflict: e.g. submitting a commit whose items are not all RCDO-linked
// (the DRAFT->LOCKED guard, surfaced as 422 rather than 409 because it is a content precondition).
// The ApiExceptionHandler maps it to an RFC-7807 422.
package com.solovis.wcm.common;

public class UnprocessableEntityException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public UnprocessableEntityException(String message) {
    super(message);
  }
}
