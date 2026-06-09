// PulseService — read/upsert the acting member's weekly Pulse for a commit (U19 thin Pulse).
// Ownership-checked: the commit must belong to the acting member (CurrentMemberProvider, KTD6),
// else 403 — a member can only read/write their OWN week's pulse. get() returns the empty reading
// when none exists yet; put() upserts the single PulseReading per commit (score 1..5).
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.PulseDto;
import com.solovis.wcm.commit.dto.PulseRequest;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.ResourceNotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PulseService {

  private final WeeklyCommitRepository commits;
  private final PulseReadingRepository pulses;
  private final CurrentMemberProvider currentMember;

  public PulseService(
      WeeklyCommitRepository commits,
      PulseReadingRepository pulses,
      CurrentMemberProvider currentMember) {
    this.commits = commits;
    this.pulses = pulses;
    this.currentMember = currentMember;
  }

  /** GET /commits/{id}/pulse — the owner's reading, or the empty reading when unrated. */
  @Transactional(readOnly = true)
  public PulseDto get(UUID commitId) {
    requireOwned(commitId);
    return pulses.findByWeeklyCommitId(commitId).stream()
        .findFirst()
        .map(PulseDto::from)
        .orElseGet(PulseDto::empty);
  }

  /** PUT /commits/{id}/pulse — upsert the single reading for the owner's commit. */
  @Transactional
  public PulseDto put(UUID commitId, PulseRequest request) {
    requireOwned(commitId);
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
  private void requireOwned(UUID commitId) {
    WeeklyCommit commit =
        commits
            .findById(commitId)
            .orElseThrow(() -> new ResourceNotFoundException("commit " + commitId + " not found"));
    if (!commit.getMemberId().equals(currentMember.currentMemberId())) {
      throw new ForbiddenException("commit " + commitId + " is not owned by the acting member");
    }
  }
}
