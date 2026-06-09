// CommitDto — wire shape of a WeeklyCommit with its items (U10/U11). The response body of
// GET/POST/PUT /commits/{id}. memberId is the resolved owner (from CurrentMemberProvider on
// create),
// echoed for the client; it is NEVER read from the request body. Mirrored by the TS CommitDto.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CommitDto(
    UUID id,
    UUID memberId,
    LocalDate weekStart,
    LifecycleState lifecycleState,
    Instant submittedAt,
    Instant reviewedAt,
    List<CommitItemDto> items) {

  /** Project a commit plus its (already-hydrated) items onto the wire shape. */
  public static CommitDto from(WeeklyCommit commit, List<CommitItem> items) {
    return new CommitDto(
        commit.getId(),
        commit.getMemberId(),
        commit.getWeekStart(),
        commit.getLifecycleState(),
        commit.getSubmittedAt(),
        commit.getReviewedAt(),
        items.stream().map(CommitItemDto::from).toList());
  }
}
