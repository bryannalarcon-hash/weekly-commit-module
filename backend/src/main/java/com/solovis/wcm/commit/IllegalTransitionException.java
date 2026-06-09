// IllegalTransitionException — thrown by LifecycleService when a state move is not legal or its
// guard fails (e.g. DRAFT->RECONCILED, or DRAFT->LOCKED with an unlinked item). Carries the
// attempted from/to so the API layer can map it to an RFC-7807 409.
package com.solovis.wcm.commit;

public class IllegalTransitionException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  private final transient LifecycleState from;
  private final transient LifecycleState to;

  public IllegalTransitionException(LifecycleState from, LifecycleState to, String reason) {
    super(
        "Illegal lifecycle transition "
            + from
            + " -> "
            + to
            + (reason == null || reason.isBlank() ? "" : ": " + reason));
    this.from = from;
    this.to = to;
  }

  public LifecycleState getFrom() {
    return from;
  }

  public LifecycleState getTo() {
    return to;
  }
}
