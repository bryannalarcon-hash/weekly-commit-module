// IllegalCommitStateException — the acting member is authenticated AND authorized, but the commit
// is
// in a lifecycle state where the requested operation makes no sense (e.g. reviewing a
// never-submitted
// DRAFT that has no frozen plan to review). Distinct from IllegalTransitionException (which guards
// FSM
// MOVES): this guards an operation that is not itself a transition but still has a state
// precondition.
// The ApiExceptionHandler maps it to an RFC-7807 409 with code "illegal_state".
package com.solovis.wcm.common;

public class IllegalCommitStateException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public IllegalCommitStateException(String message) {
    super(message);
  }
}
