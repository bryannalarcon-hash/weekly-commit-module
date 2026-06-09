// CommitService — application service for the weekly-commit CRUD + submit (U11). Orchestrates the
// repositories and the pure LifecycleService, and enforces row-level authorization (KTD6): the
// owner
// is ALWAYS the CurrentMemberProvider's acting member (never a body field); PUT/submit are
// OWNER-only
// (loadOwned → 403), while GET is readable by the owner OR the owner's MANAGER (loadOwnerOrManager,
// so the manager review-detail screen can load a report's locked commit — a manager reaches only
// their own reports). replaceItems validates each non-null supportingOutcomeId against the RCDO
// leaf table (RcdoRepository) so a garbage/nonexistent/wrong-tier link is a 404 at the application
// layer (NOT a misleading 409 from the DB FK). submit() rejects a zero-item commit as 422 before
// the link check, locks via the FSM, persists the frozen snapshot, and publishes the commit.locked
// domain event (U26).
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.CommitDto;
import com.solovis.wcm.commit.dto.CommitItemRequest;
import com.solovis.wcm.commit.dto.CreateCommitRequest;
import com.solovis.wcm.commit.dto.UpdateCommitRequest;
import com.solovis.wcm.commit.dto.WeekSummary;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.common.UnprocessableEntityException;
import com.solovis.wcm.event.DomainEvent;
import com.solovis.wcm.event.EventPublisher;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.rcdo.RcdoRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommitService {

  private final WeeklyCommitRepository commits;
  private final CommitItemRepository items;
  private final CommitSnapshotRepository snapshots;
  private final SnapshotItemRepository snapshotItems;
  private final LifecycleService lifecycle;
  private final CurrentMemberProvider currentMember;
  private final MemberRepository members;
  private final RcdoRepository rcdo;
  private final EventPublisher events;

  public CommitService(
      WeeklyCommitRepository commits,
      CommitItemRepository items,
      CommitSnapshotRepository snapshots,
      SnapshotItemRepository snapshotItems,
      LifecycleService lifecycle,
      CurrentMemberProvider currentMember,
      MemberRepository members,
      RcdoRepository rcdo,
      EventPublisher events) {
    this.commits = commits;
    this.items = items;
    this.snapshots = snapshots;
    this.snapshotItems = snapshotItems;
    this.lifecycle = lifecycle;
    this.currentMember = currentMember;
    this.members = members;
    this.rcdo = rcdo;
    this.events = events;
  }

  /** POST /commits — create a DRAFT owned by the acting member (KTD6: body memberId ignored). */
  @Transactional
  public CommitDto create(CreateCommitRequest request) {
    UUID ownerId = currentMember.currentMemberId();
    WeeklyCommit commit =
        commits.save(
            WeeklyCommit.builder()
                .memberId(ownerId)
                .weekStart(request.weekStart())
                .lifecycleState(LifecycleState.DRAFT)
                .build());
    List<CommitItem> saved = replaceItems(commit.getId(), request.safeItems());
    return CommitDto.from(commit, saved);
  }

  /**
   * GET /commits/{id} — read a commit and its items. Readable by the OWNER, OR by the owner's
   * MANAGER (so the manager review-detail screen can load a report's locked commit; KTD6 row-level:
   * a manager reaches only their own reports' commits). Any other member → 403.
   */
  @Transactional(readOnly = true)
  public CommitDto get(UUID commitId) {
    WeeklyCommit commit = loadOwnerOrManager(commitId);
    return CommitDto.from(commit, items.findByWeeklyCommitId(commitId));
  }

  /**
   * GET /commits — the acting member's own commits projected to WeekSummary headers (counts only),
   * newest week first. The full item list is fetched per-commit only when a screen opens it.
   */
  @Transactional(readOnly = true)
  public List<WeekSummary> listMine() {
    UUID ownerId = currentMember.currentMemberId();
    return commits.findByMemberId(ownerId).stream()
        .sorted(Comparator.comparing(WeeklyCommit::getWeekStart).reversed())
        .map(c -> WeekSummary.from(c, items.findByWeeklyCommitId(c.getId())))
        .toList();
  }

  /**
   * GET /commits/current — the acting member's most-recent OPEN week (any state but CARRY_FORWARD),
   * or empty when none exists yet (the controller renders 204 → the "Start your week" empty state).
   */
  @Transactional(readOnly = true)
  public Optional<CommitDto> currentWeek() {
    UUID ownerId = currentMember.currentMemberId();
    return commits.findByMemberId(ownerId).stream()
        .filter(c -> c.getLifecycleState() != LifecycleState.CARRY_FORWARD)
        .max(Comparator.comparing(WeeklyCommit::getWeekStart))
        .map(c -> CommitDto.from(c, items.findByWeeklyCommitId(c.getId())));
  }

  /**
   * PUT /commits/{id} — full-replace the item set. Content edits are legal only while DRAFT; the
   * FSM guard raises IllegalTransitionException (-> 409) for a LOCKED/later commit.
   */
  @Transactional
  public CommitDto update(UUID commitId, UpdateCommitRequest request) {
    WeeklyCommit commit = loadOwned(commitId);
    lifecycle.assertItemEditAllowed(commit, true); // content change -> 409 unless DRAFT
    List<CommitItem> saved = replaceItems(commitId, request.safeItems());
    return CommitDto.from(commit, saved);
  }

  /**
   * POST /commits/{id}/submit — DRAFT -> LOCKED via the FSM. Unlinked items fail the guard; that is
   * surfaced as 422 (a content precondition), not 409. On success the snapshot is persisted and a
   * commit.locked event published (U26).
   */
  @Transactional
  public CommitDto submit(UUID commitId) {
    WeeklyCommit commit = loadOwned(commitId);
    hydrate(commit);
    if (commit.getItems().isEmpty()) {
      // Finding #12: a zero-item commit cannot submit. The unlinked-items message below is
      // vacuously true for an empty commit, so check emptiness FIRST for a precise 422.
      throw new UnprocessableEntityException(
          "a weekly commit must have at least one item before submit");
    }
    if (!commit.allItemsLinked()) {
      throw new UnprocessableEntityException(
          "every item must link a supporting outcome before submit");
    }
    CommitSnapshot snapshot = lifecycle.lock(commit, Instant.now());
    commits.save(commit);
    snapshots.save(snapshot);
    snapshot.getItems().forEach(snapshotItems::save);
    events.publish(DomainEvent.of(DomainEvent.COMMIT_LOCKED, commit.getId(), commit.getMemberId()));
    return CommitDto.from(commit, items.findByWeeklyCommitId(commitId));
  }

  // --- internals -------------------------------------------------------------------------------

  /** Load a commit or 404, then enforce row-level ownership (403 on mismatch). */
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
   * Load a commit or 404, then allow the acting member if they are the OWNER or the owner's MANAGER
   * (the row-level rule for manager-visible reads — a manager only reaches their own reports). 403
   * for anyone else.
   */
  private WeeklyCommit loadOwnerOrManager(UUID commitId) {
    WeeklyCommit commit =
        commits
            .findById(commitId)
            .orElseThrow(() -> new ResourceNotFoundException("commit " + commitId + " not found"));
    Member acting = currentMember.currentMember();
    boolean isOwner = commit.getMemberId().equals(acting.getId());
    boolean isOwnersManager =
        members
            .findById(commit.getMemberId())
            .map(owner -> Objects.equals(owner.getManagerId(), acting.getId()))
            .orElse(false);
    if (!isOwner && !isOwnersManager) {
      throw new ForbiddenException("commit " + commitId + " is not visible to the acting member");
    }
    return commit;
  }

  /**
   * Delete the existing items and insert the requested set; returns the persisted items. Each
   * non-null supportingOutcomeId is validated against the RCDO LEAF table first (finding #1): a
   * garbage/nonexistent id -> 404, and because the finder queries only supporting_outcome an
   * Outcome/RallyCry id is rejected too (leaf-ness enforced). A null link is allowed (KTD5 —
   * nullable until lock). Validating before any write keeps a bad link from reaching the DB FK and
   * surfacing as a misleading 409.
   */
  private List<CommitItem> replaceItems(UUID commitId, List<CommitItemRequest> requested) {
    for (CommitItemRequest req : requested) {
      UUID linkId = req.supportingOutcomeId();
      if (linkId != null && rcdo.findSupportingOutcome(linkId).isEmpty()) {
        throw new ResourceNotFoundException("supporting outcome " + linkId + " not found");
      }
    }
    items.deleteAll(items.findByWeeklyCommitId(commitId));
    for (CommitItemRequest req : requested) {
      items.save(
          CommitItem.builder()
              .weeklyCommitId(commitId)
              .text(req.text())
              .status(CommitItemStatus.OPEN)
              .supportingOutcomeId(req.supportingOutcomeId())
              .chessTier(req.chessTier())
              .build());
    }
    return items.findByWeeklyCommitId(commitId);
  }

  /** Attach the persisted items to the aggregate so the FSM can guard/snapshot them. */
  private void hydrate(WeeklyCommit commit) {
    items.findByWeeklyCommitId(commit.getId()).forEach(commit::addItem);
  }
}
