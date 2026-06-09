// LifecycleServiceTest — exhaustive pure-logic tests for the weekly-commit FSM (U9).
// Drives every legal/illegal (from->to) edge, the DRAFT->LOCKED link guard, snapshot immutability
// under later status edits, the RECONCILED=>REVIEWED invariant, and incomplete-only carry-forward.
// No Spring/DB: LifecycleService operates on in-memory aggregates.
package com.solovis.wcm.commit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.solovis.wcm.review.ManagerReview;
import com.solovis.wcm.review.ReviewState;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class LifecycleServiceTest {

  private final LifecycleService service = new LifecycleService();
  private static final Instant T0 = Instant.parse("2026-06-08T12:00:00Z");
  private static final LocalDate WEEK = LocalDate.parse("2026-06-08");

  private WeeklyCommit commit(LifecycleState state) {
    return WeeklyCommit.builder()
        .id(UUID.randomUUID())
        .memberId(UUID.randomUUID())
        .weekStart(WEEK)
        .lifecycleState(state)
        .build();
  }

  private CommitItem item(boolean linked, CommitItemStatus status, ChessTier tier) {
    return CommitItem.builder()
        .id(UUID.randomUUID())
        .text("do a thing")
        .status(status)
        .supportingOutcomeId(linked ? UUID.randomUUID() : null)
        .chessTier(tier)
        .build();
  }

  // --- Exhaustive legal/illegal transition matrix ----------------------------------------------

  /** The canonical legal edges; every other (from,to) pair must be rejected. */
  private static final Set<List<LifecycleState>> LEGAL_EDGES =
      Set.of(
          List.of(LifecycleState.DRAFT, LifecycleState.LOCKED),
          List.of(LifecycleState.LOCKED, LifecycleState.RECONCILING),
          List.of(LifecycleState.RECONCILING, LifecycleState.RECONCILED),
          List.of(LifecycleState.RECONCILED, LifecycleState.CARRY_FORWARD),
          List.of(LifecycleState.LOCKED, LifecycleState.CARRY_FORWARD));

  @Test
  void transitionTableMatchesTheExpectedEdgeSetExactly() {
    for (LifecycleState from : LifecycleState.values()) {
      for (LifecycleState to : LifecycleState.values()) {
        boolean expectedLegal = LEGAL_EDGES.contains(List.of(from, to));
        assertThat(LifecycleTransition.isLegal(from, to))
            .as("edge %s -> %s", from, to)
            .isEqualTo(expectedLegal);
      }
    }
  }

  @Test
  void assertLegalAcceptsEveryLegalEdgeAndRejectsEveryIllegalEdge() {
    for (LifecycleState from : LifecycleState.values()) {
      for (LifecycleState to : LifecycleState.values()) {
        if (LEGAL_EDGES.contains(List.of(from, to))) {
          service.assertLegal(from, to);
        } else {
          assertThatThrownBy(() -> service.assertLegal(from, to))
              .as("illegal edge %s -> %s", from, to)
              .isInstanceOf(IllegalTransitionException.class);
        }
      }
    }
  }

  @ParameterizedTest
  @EnumSource(LifecycleState.class)
  void legalNextMatchesTheTableForEveryState(LifecycleState state) {
    WeeklyCommit wc = commit(state);
    Set<LifecycleState> expected =
        switch (state) {
          case DRAFT -> EnumSet.of(LifecycleState.LOCKED);
          case LOCKED -> EnumSet.of(LifecycleState.RECONCILING, LifecycleState.CARRY_FORWARD);
          case RECONCILING -> EnumSet.of(LifecycleState.RECONCILED);
          case RECONCILED -> EnumSet.of(LifecycleState.CARRY_FORWARD);
          case CARRY_FORWARD -> EnumSet.noneOf(LifecycleState.class);
        };
    assertThat(service.legalNext(wc)).containsExactlyInAnyOrderElementsOf(expected);
  }

  // --- DRAFT -> LOCKED guard + snapshot --------------------------------------------------------

  @Test
  void lockBlockedWhenAnyItemIsUnlinked() {
    WeeklyCommit wc = commit(LifecycleState.DRAFT);
    wc.addItem(item(true, CommitItemStatus.OPEN, ChessTier.KING));
    wc.addItem(item(false, CommitItemStatus.OPEN, ChessTier.PAWN)); // unlinked

    assertThatThrownBy(() -> service.lock(wc, T0))
        .isInstanceOf(IllegalTransitionException.class)
        .hasMessageContaining("supporting outcome");
    assertThat(wc.getLifecycleState()).isEqualTo(LifecycleState.DRAFT);
  }

  @Test
  void lockSucceedsWhenAllLinkedAndWritesAnImmutableSnapshot() {
    WeeklyCommit wc = commit(LifecycleState.DRAFT);
    CommitItem a = item(true, CommitItemStatus.OPEN, ChessTier.KING);
    CommitItem b = item(true, CommitItemStatus.OPEN, ChessTier.ROOK);
    wc.addItem(a).addItem(b);

    CommitSnapshot snapshot = service.lock(wc, T0);

    assertThat(wc.getLifecycleState()).isEqualTo(LifecycleState.LOCKED);
    assertThat(wc.getSubmittedAt()).isEqualTo(T0);
    assertThat(snapshot.getCapturedAt()).isEqualTo(T0);
    assertThat(snapshot.getItems()).hasSize(2);
    assertThat(snapshot.getItems())
        .extracting(SnapshotItem::getSupportingOutcomeId)
        .containsExactly(a.getSupportingOutcomeId(), b.getSupportingOutcomeId());
    assertThat(snapshot.getItems())
        .extracting(SnapshotItem::getChessTier)
        .containsExactly(ChessTier.KING, ChessTier.ROOK);
    // U13 join key: each frozen line back-references its source CommitItem's id deterministically.
    assertThat(snapshot.getItems())
        .extracting(SnapshotItem::getCommitItemId)
        .containsExactly(a.getId(), b.getId());
  }

  @Test
  void snapshotIsNotMutatedByLaterLiveStatusEdits() {
    WeeklyCommit wc = commit(LifecycleState.DRAFT);
    CommitItem live = item(true, CommitItemStatus.OPEN, ChessTier.KING);
    wc.addItem(live);

    CommitSnapshot snapshot = service.lock(wc, T0);
    String frozenText = snapshot.getItems().get(0).getText();

    // Later, in RECONCILING, the live item's actual status flips and text is meddled with.
    live.setStatus(CommitItemStatus.INCOMPLETE);
    live.setText("ENTIRELY DIFFERENT");

    assertThat(snapshot.getItems().get(0).getText()).isEqualTo(frozenText);
    assertThat(snapshot.getItems().get(0).getText()).isNotEqualTo("ENTIRELY DIFFERENT");
    // Snapshot items carry no status at all (KTD4): the frozen plan has no actual.
    assertThat(SnapshotItem.class.getDeclaredFields())
        .extracting(java.lang.reflect.Field::getName)
        .doesNotContain("status");
  }

  @Test
  void snapshotListIsUnmodifiable() {
    WeeklyCommit wc = commit(LifecycleState.DRAFT);
    wc.addItem(item(true, CommitItemStatus.OPEN, ChessTier.KING));
    CommitSnapshot snapshot = service.lock(wc, T0);
    assertThatThrownBy(() -> snapshot.getItems().clear())
        .isInstanceOf(UnsupportedOperationException.class);
  }

  // --- LOCKED -> RECONCILING -------------------------------------------------------------------

  @Test
  void startReconcilingMovesLockedToReconciling() {
    WeeklyCommit wc = commit(LifecycleState.LOCKED);
    service.startReconciling(wc);
    assertThat(wc.getLifecycleState()).isEqualTo(LifecycleState.RECONCILING);
  }

  @Test
  void startReconcilingRejectedFromNonLocked() {
    WeeklyCommit wc = commit(LifecycleState.DRAFT);
    assertThatThrownBy(() -> service.startReconciling(wc))
        .isInstanceOf(IllegalTransitionException.class);
  }

  // --- RECONCILING -> RECONCILED forces REVIEWED -----------------------------------------------

  @Test
  void reconcileForcesManagerReviewToReviewedAndStampsTimes() {
    WeeklyCommit wc = commit(LifecycleState.RECONCILING);
    ManagerReview review =
        ManagerReview.builder().weeklyCommitId(wc.getId()).state(ReviewState.INCOMPLETE).build();

    service.reconcile(wc, review, T0);

    assertThat(wc.getLifecycleState()).isEqualTo(LifecycleState.RECONCILED);
    assertThat(wc.getReviewedAt()).isEqualTo(T0);
    assertThat(review.getState()).isEqualTo(ReviewState.REVIEWED);
    assertThat(review.isReviewed()).isTrue();
    assertThat(review.getReviewedAt()).isEqualTo(T0);
  }

  @Test
  void reconcileRejectedFromNonReconciling() {
    WeeklyCommit wc = commit(LifecycleState.LOCKED);
    ManagerReview review = ManagerReview.builder().weeklyCommitId(wc.getId()).build();
    assertThatThrownBy(() -> service.reconcile(wc, review, T0))
        .isInstanceOf(IllegalTransitionException.class);
  }

  // --- Carry-forward: incomplete-only, from RECONCILED and LOCKED escape hatch -----------------

  @Test
  void carryForwardCopiesOnlyIncompleteItemsIntoNextWeekDraft() {
    WeeklyCommit wc = commit(LifecycleState.RECONCILED);
    CommitItem done = item(true, CommitItemStatus.COMPLETE, ChessTier.KING);
    CommitItem missed = item(true, CommitItemStatus.INCOMPLETE, ChessTier.ROOK);
    wc.addItem(done).addItem(missed);

    LocalDate nextWeek = WEEK.plusWeeks(1);
    WeeklyCommit next = service.carryForward(wc, nextWeek);

    assertThat(wc.getLifecycleState()).isEqualTo(LifecycleState.CARRY_FORWARD);
    assertThat(next.getLifecycleState()).isEqualTo(LifecycleState.DRAFT);
    assertThat(next.getWeekStart()).isEqualTo(nextWeek);
    assertThat(next.getMemberId()).isEqualTo(wc.getMemberId());
    assertThat(next.getItems()).hasSize(1);

    CommitItem carried = next.getItems().get(0);
    assertThat(carried.getCarriedFromItemId()).isEqualTo(missed.getId());
    assertThat(carried.getStatus()).isEqualTo(CommitItemStatus.OPEN);
    assertThat(carried.getSupportingOutcomeId()).isEqualTo(missed.getSupportingOutcomeId());
    assertThat(carried.getChessTier()).isEqualTo(ChessTier.ROOK);
    // The completed item is not carried; the source incomplete item is marked CARRIED_FORWARD.
    assertThat(missed.getStatus()).isEqualTo(CommitItemStatus.CARRIED_FORWARD);
    assertThat(done.getStatus()).isEqualTo(CommitItemStatus.COMPLETE);
  }

  @Test
  void carryForwardAllowedDirectlyFromLockedEscapeHatch() {
    WeeklyCommit wc = commit(LifecycleState.LOCKED);
    wc.addItem(item(true, CommitItemStatus.INCOMPLETE, ChessTier.PAWN));
    WeeklyCommit next = service.carryForward(wc, WEEK.plusWeeks(1));
    assertThat(wc.getLifecycleState()).isEqualTo(LifecycleState.CARRY_FORWARD);
    assertThat(next.getItems()).hasSize(1);
  }

  @Test
  void carryForwardRejectedFromDraftOrReconciling() {
    for (LifecycleState illegal : List.of(LifecycleState.DRAFT, LifecycleState.RECONCILING)) {
      WeeklyCommit wc = commit(illegal);
      assertThatThrownBy(() -> service.carryForward(wc, WEEK.plusWeeks(1)))
          .as("carry-forward from %s", illegal)
          .isInstanceOf(IllegalTransitionException.class);
    }
  }

  // --- Item-edit guard: status-only legal in RECONCILING, content edits only in DRAFT ----------

  @Test
  void statusOnlyEditLegalInReconcilingButContentEditRejected() {
    WeeklyCommit wc = commit(LifecycleState.RECONCILING);
    service.assertItemEditAllowed(wc, false); // status edit ok
    assertThatThrownBy(() -> service.assertItemEditAllowed(wc, true)) // content edit rejected
        .isInstanceOf(IllegalTransitionException.class);
  }

  @Test
  void contentEditLegalOnlyInDraft() {
    service.assertItemEditAllowed(commit(LifecycleState.DRAFT), true);
    for (LifecycleState s :
        List.of(LifecycleState.LOCKED, LifecycleState.RECONCILED, LifecycleState.CARRY_FORWARD)) {
      assertThatThrownBy(() -> service.assertItemEditAllowed(commit(s), true))
          .as("content edit in %s", s)
          .isInstanceOf(IllegalTransitionException.class);
    }
  }

  @Test
  void statusEditRejectedOutsideDraftOrReconciling() {
    for (LifecycleState s :
        List.of(LifecycleState.LOCKED, LifecycleState.RECONCILED, LifecycleState.CARRY_FORWARD)) {
      assertThatThrownBy(() -> service.assertItemEditAllowed(commit(s), false))
          .as("status edit in %s", s)
          .isInstanceOf(IllegalTransitionException.class);
    }
  }

  // --- Misc domain helpers ---------------------------------------------------------------------

  @Test
  void chessTierOrderingPlacesKingHighest() {
    assertThat(ChessTier.KING.outranks(ChessTier.PAWN)).isTrue();
    assertThat(ChessTier.PAWN.outranks(ChessTier.KING)).isFalse();
    assertThat(ChessTier.QUEEN.outranks(ChessTier.ROOK)).isTrue();
  }

  @Test
  void illegalTransitionExceptionCarriesFromAndTo() {
    IllegalTransitionException ex =
        new IllegalTransitionException(LifecycleState.DRAFT, LifecycleState.RECONCILED, "nope");
    assertThat(ex.getFrom()).isEqualTo(LifecycleState.DRAFT);
    assertThat(ex.getTo()).isEqualTo(LifecycleState.RECONCILED);
    assertThat(ex.getMessage()).contains("DRAFT").contains("RECONCILED").contains("nope");
  }
}
