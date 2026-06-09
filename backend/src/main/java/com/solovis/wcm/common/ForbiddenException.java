// ForbiddenException — the acting member is authenticated but not authorized for this row
// (KTD6 row-level/ownership check): e.g. reading another member's commit, or a manager reaching
// another manager's reports. The ApiExceptionHandler maps it to an RFC-7807 403.
package com.solovis.wcm.common;

public class ForbiddenException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public ForbiddenException(String message) {
    super(message);
  }
}
