// PulseService — read/upsert the weekly Pulse for a commit (U19 thin Pulse). READS are row-level
// authorized for the OWNER or the owner's DIRECT MANAGER (the editor's privacy toggle is "Visible
// to your manager only", so the manager review screen reads it — mirrors
// ReconciliationService.loadOwnerOrManager, KTD6); WRITES stay strictly owner-only. put() upserts
// the single PulseReading per commit (score 1..5) and is legal only inside the editable window
// (DRAFT/LOCKED/RECONCILING) — once RECONCILED/CARRY_FORWARD the week is frozen and it 409s with
// the same illegal_transition problem the item-edit path uses. get() returns the empty reading
// when none exists yet.
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.PulseDto;
import com.solovis.wcm.commit.dto.PulseRequest;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.member.MemberRepository;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PulseService {

  private final WeeklyCommitRepository commits;
  private final PulseReadingRepository pulses;
  private final MemberRepository members;
  private final CurrentMemberProvider currentMember;

  public PulseService(
      WeeklyCommitRepository commits,
      PulseReadingRepository pulses,
      MemberRepository members,
      CurrentMemberProvider currentMember) {
    this.commits = commits;
    this.pulses = pulses;
    this.members = members;
    this.currentMember = currentMember;
  }

  /**
   * GET /commits/{id}/pulse — the reading, or the empty reading when unrated. Readable by the OWNER
   * or the owner's DIRECT MANAGER (the pulse is "visible to your manager only" by design).
   */
  @Transactional(readOnly = true)
  public PulseDto get(UUID commitId) {
    requireOwnerOrManager(commitId);
    return pulses.findByWeeklyCommitId(commitId).stream()
        .findFirst()
        .map(PulseDto::from)
        .orElseGet(PulseDto::empty);
  }

  /**
   * PUT /commits/{id}/pulse — upsert the single reading for the owner's commit. Owner-only, and
   * legal only while the week is still editable (DRAFT/LOCKED/RECONCILING): a RECONCILED or
   * CARRY_FORWARD commit is frozen, matching the item-edit guard's 409.
   */
  @Transactional
  public PulseDto put(UUID commitId, PulseRequest request) {
    WeeklyCommit commit = requireOwned(commitId);
    assertPulseEditAllowed(commit);
    PulseReading reading =
        pulses.findByWeeklyCommitId(commitId).stream()
            .findFirst()
            .orElseGet(
                () -> PulseReading.builder().weeklyCommitId(commitId).score((short) 1).build());
    reading.setScore(request.rating().shortValue());
    reading.setComment(request.comment());
    reading.setCommentPrivate(request.privateOrFalse());
    return PulseDto.from(pulses.save(reading));
  }

  /** Load the commit (404) and enforce row-level ownership (403 on mismatch). */
  private WeeklyCommit requireOwned(UUID commitId) {
    WeeklyCommit commit = load(commitId);
    if (!commit.getMemberId().equals(currentMember.currentMemberId())) {
      throw new ForbiddenException("commit " + commitId + " is not owned by the acting member");
    }
    return commit;
  }

  /**
   * Load the commit (404), then allow the acting member if they are the OWNER or the owner's DIRECT
   * MANAGER (owner.managerId == acting id) — the same row-level read rule
   * ReconciliationService.loadOwnerOrManager enforces. 403 for anyone else.
   */
  private void requireOwnerOrManager(UUID commitId) {
    WeeklyCommit commit = load(commitId);
    UUID actingId = currentMember.currentMemberId();
    boolean isOwner = commit.getMemberId().equals(actingId);
    boolean isOwnersManager =
        members
            .findById(commit.getMemberId())
            .map(owner -> Objects.equals(owner.getManagerId(), actingId))
            .orElse(false);
    if (!isOwner && !isOwnersManager) {
      throw new ForbiddenException("commit " + commitId + " is not visible to the acting member");
    }
  }

  /**
   * Freeze guard for pulse writes: legal only while DRAFT, LOCKED, or RECONCILING. Once the week is
   * RECONCILED (or CARRY_FORWARD) it is frozen — same 409 illegal_transition shape as
   * LifecycleService.assertItemEditAllowed raises for item edits.
   */
  private static void assertPulseEditAllowed(WeeklyCommit commit) {
    LifecycleState state = commit.getLifecycleState();
    if (state == LifecycleState.RECONCILED || state == LifecycleState.CARRY_FORWARD) {
      throw new IllegalTransitionException(
          state, state, "pulse edits are only allowed while DRAFT, LOCKED, or RECONCILING");
    }
  }

  private WeeklyCommit load(UUID commitId) {
    return commits
        .findById(commitId)
        .orElseThrow(() -> new ResourceNotFoundException("commit " + commitId + " not found"));
  }
}
