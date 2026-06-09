// ReconciliationService — owns the reconcile half of the lifecycle (U13). The actor model splits by
// transition (KTD6): the MANAGER who manages the commit's owner drives the LOCKED->RECONCILING and
// RECONCILING->RECONCILED transitions (loadAsManager: canReview() && manages the owner), matching
// ReviewService; the OWNER records actuals (status patches), reads their own planned-vs-actual
// diff,
// and carries their incomplete items into next week (loadOwned). The diff joins the frozen snapshot
// (planned) to live CommitItem.status (actual) on commitItemId, flagging completed/incomplete/
// carried and ADDED_AFTER_LOCK (a live item with no plan line). Pre-LOCK (no snapshot) the diff is
// not applicable — it returns an empty view rather than flagging in-progress draft items as
// ADDED_AFTER_LOCK. Reconciled forces the ManagerReview REVIEWED and publishes review.completed
// (U26).
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.CommitDto;
import com.solovis.wcm.commit.dto.ItemStatusPatch;
import com.solovis.wcm.commit.dto.ReconciliationFlag;
import com.solovis.wcm.commit.dto.ReconciliationRow;
import com.solovis.wcm.commit.dto.ReconciliationView;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.event.DomainEvent;
import com.solovis.wcm.event.EventPublisher;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.review.ManagerReview;
import com.solovis.wcm.review.ManagerReviewRepository;
import com.solovis.wcm.review.ReviewState;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReconciliationService {

  private final WeeklyCommitRepository commits;
  private final CommitItemRepository items;
  private final CommitSnapshotRepository snapshots;
  private final SnapshotItemRepository snapshotItems;
  private final ManagerReviewRepository reviews;
  private final MemberRepository members;
  private final LifecycleService lifecycle;
  private final CurrentMemberProvider currentMember;
  private final EventPublisher events;

  public ReconciliationService(
      WeeklyCommitRepository commits,
      CommitItemRepository items,
      CommitSnapshotRepository snapshots,
      SnapshotItemRepository snapshotItems,
      ManagerReviewRepository reviews,
      MemberRepository members,
      LifecycleService lifecycle,
      CurrentMemberProvider currentMember,
      EventPublisher events) {
    this.commits = commits;
    this.items = items;
    this.snapshots = snapshots;
    this.snapshotItems = snapshotItems;
    this.reviews = reviews;
    this.members = members;
    this.lifecycle = lifecycle;
    this.currentMember = currentMember;
    this.events = events;
  }

  /**
   * POST /commits/{id}/reconcile — LOCKED -> RECONCILING (opens the status-edit window). Driven by
   * the owner's manager (loadAsManager), never the owner themselves.
   */
  @Transactional
  public CommitDto startReconciling(UUID commitId) {
    WeeklyCommit commit = loadAsManager(commitId);
    lifecycle.startReconciling(commit);
    commits.save(commit);
    return CommitDto.from(commit, items.findByWeeklyCommitId(commitId));
  }

  /**
   * PATCH /commits/{id}/items/{itemId}/status — status-only edit by the OWNER recording an item's
   * ACTUAL. The FSM guard (assertItemEditAllowed, contentChanged=false) permits this only while
   * RECONCILING, raising 409 otherwise. Keeps the frozen snapshot untouched.
   */
  @Transactional
  public CommitDto patchItemStatus(UUID commitId, UUID itemId, ItemStatusPatch patch) {
    WeeklyCommit commit = loadOwned(commitId);
    lifecycle.assertItemEditAllowed(commit, false);
    CommitItem item =
        items
            .findById(itemId)
            .filter(i -> i.getWeeklyCommitId().equals(commitId))
            .orElseThrow(
                () ->
                    new ResourceNotFoundException("item " + itemId + " not in commit " + commitId));
    item.setStatus(patch.status());
    items.save(item);
    return CommitDto.from(commit, items.findByWeeklyCommitId(commitId));
  }

  /**
   * POST /commits/{id}/reconciled — RECONCILING -> RECONCILED. Driven by the owner's manager
   * (loadAsManager): they (and only they) force the ManagerReview REVIEWED (creating one if
   * absent), stamping the acting manager as reviewer, and publish review.completed (U26). An
   * employee owner can never self-mark their own commit RECONCILED — the manages-the-owner check
   * forbids it.
   */
  @Transactional
  public CommitDto markReconciled(UUID commitId) {
    Member manager = currentMember.currentMember();
    WeeklyCommit commit = requireManagerOf(commitId, manager);
    ManagerReview review =
        reviews
            .findByWeeklyCommitId(commitId)
            .orElseGet(
                () ->
                    ManagerReview.builder()
                        .weeklyCommitId(commitId)
                        .reviewerId(manager.getId())
                        .state(ReviewState.INCOMPLETE)
                        .build());
    review.setReviewerId(manager.getId());
    commit.setReviewerId(manager.getId());
    lifecycle.reconcile(commit, review, Instant.now());
    commits.save(commit);
    reviews.save(review);
    events.publish(
        DomainEvent.of(DomainEvent.REVIEW_COMPLETED, commit.getId(), commit.getMemberId()));
    return CommitDto.from(commit, items.findByWeeklyCommitId(commitId));
  }

  /**
   * GET /commits/{id}/reconciliation — planned (snapshot) vs actual (live status). Joins on
   * commitItemId; a live item absent from the snapshot is ADDED_AFTER_LOCK.
   */
  @Transactional(readOnly = true)
  public ReconciliationView reconciliation(UUID commitId) {
    WeeklyCommit commit = loadOwned(commitId);

    // No snapshot exists until LOCK. For a pre-LOCK commit (DRAFT) the live items ARE the
    // plan-in-progress, not post-lock additions — joining them against an empty snapshot would
    // wrongly flag every one ADDED_AFTER_LOCK and present a meaningless diff. Serve an empty,
    // not-applicable view instead (still echoing the lifecycle state so the FE's not-yet-locked
    // path can redirect). The diff only makes sense once a frozen plan exists.
    if (snapshots.findByWeeklyCommitId(commitId).isEmpty()) {
      return new ReconciliationView(commitId, commit.getLifecycleState(), List.of());
    }

    List<CommitItem> liveItems = items.findByWeeklyCommitId(commitId);
    List<SnapshotItem> planned =
        snapshots
            .findByWeeklyCommitId(commitId)
            .map(s -> snapshotItems.findBySnapshotId(s.getId()))
            .orElseGet(List::of);

    Set<UUID> plannedItemIds = new HashSet<>();
    List<ReconciliationRow> rows = new ArrayList<>();

    for (SnapshotItem plan : planned) {
      plannedItemIds.add(plan.getCommitItemId());
      CommitItem live = findLive(liveItems, plan.getCommitItemId());
      CommitItemStatus actual = live == null ? null : live.getStatus();
      rows.add(
          new ReconciliationRow(
              plan.getCommitItemId(),
              plan.getText(),
              plan.getChessTier(),
              plan.getSupportingOutcomeId(),
              actual,
              flagFor(actual)));
    }

    for (CommitItem live : liveItems) {
      if (!plannedItemIds.contains(live.getId())) {
        rows.add(
            new ReconciliationRow(
                live.getId(),
                live.getText(),
                live.getChessTier(),
                live.getSupportingOutcomeId(),
                live.getStatus(),
                ReconciliationFlag.ADDED_AFTER_LOCK));
      }
    }
    return new ReconciliationView(commitId, commit.getLifecycleState(), rows);
  }

  /**
   * POST /commits/{id}/carry-forward — copy unfinished items (OPEN or INCOMPLETE) into a fresh
   * next-week DRAFT (from RECONCILED or the LOCKED escape hatch, enforced by the FSM); an OWNER
   * operation. If the owner already has a commit for that next week (a started draft or a prior
   * carry-forward), the uq_weekly_commit_member_week constraint would be violated — we reject that
   * up front with a clean 409 (IllegalTransitionException) rather than letting it surface as a 500.
   */
  @Transactional
  public CommitDto carryForward(UUID commitId) {
    WeeklyCommit commit = loadOwned(commitId);
    LocalDate nextWeekStart = commit.getWeekStart().plusWeeks(1);
    commits
        .findByMemberIdAndWeekStart(commit.getMemberId(), nextWeekStart)
        .ifPresent(
            existing -> {
              throw new IllegalTransitionException(
                  commit.getLifecycleState(),
                  LifecycleState.CARRY_FORWARD,
                  "a commit already exists for week "
                      + nextWeekStart
                      + "; resolve it before carrying forward");
            });
    items.findByWeeklyCommitId(commitId).forEach(commit::addItem);
    WeeklyCommit next = lifecycle.carryForward(commit, nextWeekStart);
    commits.save(commit);
    commit.getItems().forEach(items::save); // persist CARRIED_FORWARD status on sources
    WeeklyCommit savedNext;
    try {
      // The unique(member, week) collision (a concurrent draft/carry-forward that slipped past the
      // pre-check above) surfaces here, on the INSERT of the new week — map it to a clean 409.
      savedNext = commits.saveAndFlush(next);
    } catch (DataIntegrityViolationException race) {
      throw new IllegalTransitionException(
          commit.getLifecycleState(),
          LifecycleState.CARRY_FORWARD,
          "a commit already exists for week "
              + nextWeekStart
              + "; resolve it before carrying forward");
    }
    // The FSM builds carried items without a weekly_commit_id (it cannot know the new commit's id);
    // stamp it here before persisting so the NOT NULL FK is satisfied.
    next.getItems()
        .forEach(
            item -> {
              item.setWeeklyCommitId(savedNext.getId());
              items.save(item);
            });
    return CommitDto.from(savedNext, items.findByWeeklyCommitId(savedNext.getId()));
  }

  // --- internals -------------------------------------------------------------------------------

  private static ReconciliationFlag flagFor(CommitItemStatus status) {
    if (status == null) {
      return ReconciliationFlag.INCOMPLETE;
    }
    return switch (status) {
      case COMPLETE -> ReconciliationFlag.COMPLETED;
      case CARRIED_FORWARD -> ReconciliationFlag.CARRIED;
      case OPEN, INCOMPLETE -> ReconciliationFlag.INCOMPLETE;
    };
  }

  private static CommitItem findLive(List<CommitItem> liveItems, UUID commitItemId) {
    return liveItems.stream().filter(i -> i.getId().equals(commitItemId)).findFirst().orElse(null);
  }

  private WeeklyCommit loadOwned(UUID commitId) {
    WeeklyCommit commit =
        commits
            .findById(commitId)
            .orElseThrow(() -> new ResourceNotFoundException("commit " + commitId + " not found"));
    if (!commit.getMemberId().equals(currentMember.currentMemberId())) {
      throw new ForbiddenException("commit " + commitId + " is not owned by the acting member");
    }
    return commit;
  }

  /**
   * Load the commit, then 403 unless the acting member is a manager OF the commit's owner (KTD6).
   */
  private WeeklyCommit loadAsManager(UUID commitId) {
    return requireManagerOf(commitId, currentMember.currentMember());
  }

  /**
   * Load the commit, then 403 unless {@code manager} canReview() AND manages the commit's owner —
   * the same row-level rule ReviewService enforces. An employee owner never satisfies this, so the
   * RECONCILING<->RECONCILED transitions cannot be self-driven (no manager-review bypass).
   */
  private WeeklyCommit requireManagerOf(UUID commitId, Member manager) {
    WeeklyCommit commit =
        commits
            .findById(commitId)
            .orElseThrow(() -> new ResourceNotFoundException("commit " + commitId + " not found"));
    UUID ownersManagerId =
        members.findById(commit.getMemberId()).map(Member::getManagerId).orElse(null);
    if (!manager.canReview() || !Objects.equals(manager.getId(), ownersManagerId)) {
      throw new ForbiddenException(
          "only the owner's manager may drive the reconcile transitions on commit " + commitId);
    }
    return commit;
  }
}
