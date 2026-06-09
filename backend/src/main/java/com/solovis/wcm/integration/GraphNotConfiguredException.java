// GraphNotConfiguredException — raised by GraphConsentState.requireKey() when the Microsoft Graph
// integration has no signing/encryption key (wcm.graph.token-enc-key unset). The
// ApiExceptionHandler
// maps it to a 503 problem+json (code "graph_not_configured"): the consent connect/callback cannot
// proceed because the deployment is not configured, which is a server-state problem — not a forged
// request (400) nor an auth failure (401/403). Surfaces CLEARLY instead of the prior bare 403/empty
// that an escaping IllegalStateException produced via the stateless chain's /error dispatch.
// Extends IllegalStateException (it IS an illegal-state condition) so callers/tests that catch the
// broader type still match, while the @ExceptionHandler(GraphNotConfiguredException.class) — the
// most specific advice match — renders the dedicated 503 rather than a generic 500.
package com.solovis.wcm.integration;

public class GraphNotConfiguredException extends IllegalStateException {

  private static final long serialVersionUID = 1L;

  public GraphNotConfiguredException(String message) {
    super(message);
  }
}
