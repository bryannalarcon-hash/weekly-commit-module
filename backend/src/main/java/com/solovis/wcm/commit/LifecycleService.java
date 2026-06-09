// LifecycleService — server-enforced weekly-commit FSM (KTD3/KTD4/KTD5), pure domain logic.
// Owns the legal-transition guards and the side effects each transition implies: LOCK writes the
// immutable snapshot (guard: every item linked); RECONCILED forces ManagerReview=REVIEWED; CARRY
// FORWARD copies UNFINISHED items (OPEN or INCOMPLETE) into a fresh next-week DRAFT. No
// repositories
// — callers persist the returned objects, keeping this exhaustively unit-testable without a
// database.
// Status-only item edits are legal ONLY while RECONCILING (KTD4); content edits only while DRAFT.
package com.solovis.wcm.commit;

import com.solovis.wcm.review.ManagerReview;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class LifecycleService {

  /**
   * Validate an arbitrary {@code from -> to} move against the legal-transition table only (no
   * side-effect guards). Throws {@link IllegalTransitionException} if the edge is not enumerated.
   * Use the typed methods (lock/startReconciling/reconcile/carryForward) for guarded transitions.
   */
  public void assertLegal(LifecycleState from, LifecycleState to) {
    if (!LifecycleTransition.isLegal(from, to)) {
      throw new IllegalTransitionException(from, to, "not an allowed edge");
    }
  }

  /**
   * DRAFT -> LOCKED. Guards: (1) the commit must carry AT LEAST ONE item — an empty commit cannot
   * lock (a vacuous all-linked check used to allow it); (2) KTD5: EVERY item must be linked to a
   * SupportingOutcome, else throw. On success, freezes the plan into a {@link CommitSnapshot}
   * (text/link/tier only, KTD4), sets the commit LOCKED and stamps submittedAt. Returns the
   * snapshot the caller persists.
   */
  public CommitSnapshot lock(WeeklyCommit commit, Instant lockedAt) {
    requireState(commit, LifecycleState.DRAFT, LifecycleState.LOCKED);
    if (commit.getItems().isEmpty()) {
      throw new IllegalTransitionException(
          LifecycleState.DRAFT,
          LifecycleState.LOCKED,
          "a commit must have at least one item before lock");
    }
    for (CommitItem item : commit.getItems()) {
      if (!item.isLinked()) {
        throw new IllegalTransitionException(
            LifecycleState.DRAFT,
            LifecycleState.LOCKED,
            "every item must link a supporting outcome before lock");
      }
    }
    CommitSnapshot snapshot =
        CommitSnapshot.builder().weeklyCommitId(commit.getId()).capturedAt(lockedAt).build();
    for (CommitItem item : commit.getItems()) {
      snapshot.addItem(SnapshotItem.freeze(snapshot.getId(), item));
    }
    commit.setLifecycleState(LifecycleState.LOCKED);
    commit.setSubmittedAt(lockedAt);
    return snapshot;
  }

  /** LOCKED -> RECONCILING. Opens the reconcile/review window where status edits become legal. */
  public void startReconciling(WeeklyCommit commit) {
    requireState(commit, LifecycleState.LOCKED, LifecycleState.RECONCILING);
    commit.setLifecycleState(LifecycleState.RECONCILING);
  }

  /**
   * RECONCILING -> RECONCILED. Invariant: marks the {@link ManagerReview} REVIEWED (RECONCILED =>
   * REVIEWED) and stamps reviewedAt on both the review and the commit.
   */
  public void reconcile(WeeklyCommit commit, ManagerReview review, Instant reviewedAt) {
    requireState(commit, LifecycleState.RECONCILING, LifecycleState.RECONCILED);
    Objects.requireNonNull(review, "a ManagerReview is required to reconcile");
    review.markReviewed(reviewedAt);
    commit.setLifecycleState(LifecycleState.RECONCILED);
    commit.setReviewedAt(reviewedAt);
  }

  /**
   * RECONCILED -> CARRY_FORWARD, or the LOCKED -> CARRY_FORWARD escape hatch. Builds the next
   * week's DRAFT and copies every UNFINISHED item into it — OPEN or INCOMPLETE (carriedFromItemId =
   * source id, status reset to OPEN). This matches the reconciliation diff (which flags OPEN as
   * INCOMPLETE) so nothing the user sees as unfinished is dropped, and the LOCKED escape hatch
   * (where every item is still OPEN) carries its whole plan forward. Marks the carried source items
   * CARRIED_FORWARD and the source commit CARRY_FORWARD. Returns the new DRAFT for the caller to
   * persist.
   */
  public WeeklyCommit carryForward(WeeklyCommit commit, LocalDate nextWeekStart) {
    LifecycleState from = commit.getLifecycleState();
    if (from != LifecycleState.RECONCILED && from != LifecycleState.LOCKED) {
      throw new IllegalTransitionException(
          from, LifecycleState.CARRY_FORWARD, "carry-forward only from RECONCILED or LOCKED");
    }
    WeeklyCommit next =
        WeeklyCommit.builder()
            .memberId(commit.getMemberId())
            .weekStart(nextWeekStart)
            .lifecycleState(LifecycleState.DRAFT)
            .build();
    for (CommitItem source : commit.getItems()) {
      if (source.isUnfinished()) {
        next.addItem(
            CommitItem.builder()
                .text(source.getText())
                .status(CommitItemStatus.OPEN)
                .supportingOutcomeId(source.getSupportingOutcomeId())
                .chessTier(source.getChessTier())
                .carriedFromItemId(source.getId())
                .build());
        source.setStatus(CommitItemStatus.CARRIED_FORWARD);
      }
    }
    commit.setLifecycleState(LifecycleState.CARRY_FORWARD);
    return next;
  }

  /**
   * Guard for item mutations (KTD4): a content edit (text/link/tier) is legal ONLY while DRAFT; a
   * status-only edit is legal ONLY while RECONCILING. In DRAFT an item's ACTUAL has no meaning yet
   * (the plan isn't locked), so a status patch is rejected there too. Throws on violation.
   */
  public void assertItemEditAllowed(WeeklyCommit commit, boolean contentChanged) {
    LifecycleState state = commit.getLifecycleState();
    if (contentChanged && state != LifecycleState.DRAFT) {
      throw new IllegalTransitionException(
          state, state, "content edits are only allowed while DRAFT");
    }
    if (!contentChanged && state != LifecycleState.RECONCILING) {
      throw new IllegalTransitionException(
          state, state, "status edits are only allowed while RECONCILING");
    }
  }

  /** The legal next states from the commit's current state (for API discoverability/tests). */
  public List<LifecycleState> legalNext(WeeklyCommit commit) {
    return List.copyOf(LifecycleTransition.legalTargets(commit.getLifecycleState()));
  }

  private void requireState(WeeklyCommit commit, LifecycleState expected, LifecycleState target) {
    LifecycleState actual = commit.getLifecycleState();
    if (actual != expected) {
      throw new IllegalTransitionException(actual, target, "must be " + expected + " first");
    }
  }
}
