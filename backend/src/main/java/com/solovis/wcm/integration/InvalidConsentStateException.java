// InvalidConsentStateException — raised by GraphConsentState when an OAuth consent `state` cannot
// be
// trusted (missing, malformed, signature mismatch, or expired). The ApiExceptionHandler maps it to
// a
// 400: a callback presenting an unverifiable state is a rejected/forged request, not an auth
// failure
// of a logged-in principal. Guards the consent callback against CSRF / authorization-code
// injection.
package com.solovis.wcm.integration;

public class InvalidConsentStateException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public InvalidConsentStateException(String message) {
    super(message);
  }
}
