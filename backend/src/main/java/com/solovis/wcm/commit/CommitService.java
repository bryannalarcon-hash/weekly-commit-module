// CommitService — application service for the weekly-commit CRUD + submit (U11). Orchestrates the
// repositories and the pure LifecycleService, and enforces the two non-negotiable rules: the owner
// is ALWAYS the CurrentMemberProvider's acting member (never a body field, KTD6), and every
// GET/PUT/submit runs a row-level ownership check (ForbiddenException on mismatch). submit() locks
// via the FSM, persists the frozen snapshot, and publishes the commit.locked domain event (U26).
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.CommitDto;
import com.solovis.wcm.commit.dto.CommitItemRequest;
import com.solovis.wcm.commit.dto.CreateCommitRequest;
import com.solovis.wcm.commit.dto.UpdateCommitRequest;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.common.UnprocessableEntityException;
import com.solovis.wcm.event.DomainEvent;
import com.solovis.wcm.event.EventPublisher;
import java.time.Instant;
import java.util.List;
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
  private final EventPublisher events;

  public CommitService(
      WeeklyCommitRepository commits,
      CommitItemRepository items,
      CommitSnapshotRepository snapshots,
      SnapshotItemRepository snapshotItems,
      LifecycleService lifecycle,
      CurrentMemberProvider currentMember,
      EventPublisher events) {
    this.commits = commits;
    this.items = items;
    this.snapshots = snapshots;
    this.snapshotItems = snapshotItems;
    this.lifecycle = lifecycle;
    this.currentMember = currentMember;
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

  /** GET /commits/{id} — ownership-checked read of a commit and its items. */
  @Transactional(readOnly = true)
  public CommitDto get(UUID commitId) {
    WeeklyCommit commit = loadOwned(commitId);
    return CommitDto.from(commit, items.findByWeeklyCommitId(commitId));
  }

  /** GET /commits — the acting member's own commits (headers only, items omitted for the list). */
  @Transactional(readOnly = true)
  public List<CommitDto> listMine() {
    UUID ownerId = currentMember.currentMemberId();
    return commits.findByMemberId(ownerId).stream()
        .map(c -> CommitDto.from(c, items.findByWeeklyCommitId(c.getId())))
        .toList();
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

  /** Delete the existing items and insert the requested set; returns the persisted items. */
  private List<CommitItem> replaceItems(UUID commitId, List<CommitItemRequest> requested) {
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
