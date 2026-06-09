// ResourceNotFoundException — a requested aggregate (commit, item, outcome) does not exist.
// The ApiExceptionHandler maps it to an RFC-7807 404. Note ownership failures use
// ForbiddenException, not this, so a member cannot probe existence of another member's rows.
package com.solovis.wcm.common;

public class ResourceNotFoundException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public ResourceNotFoundException(String message) {
    super(message);
  }
}
