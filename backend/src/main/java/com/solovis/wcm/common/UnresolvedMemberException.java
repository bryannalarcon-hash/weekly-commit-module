// UnresolvedMemberException — raised by a CurrentMemberProvider when no acting member can be
// resolved (no authenticated JWT, or a token with no subject claim). The ApiExceptionHandler maps
// it to a 401, since an unresolvable caller is effectively unauthenticated. Note: the security
// filter chain rejects most unauthenticated requests with 401 before a controller runs.
package com.solovis.wcm.common;

public class UnresolvedMemberException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public UnresolvedMemberException(String message) {
    super(message);
  }
}
