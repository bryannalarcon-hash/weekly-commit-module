// WeekSummary — a compact header for one of the acting member's weekly commits (the My-Week landing
// + History list). Avoids shipping every item just to render a row: counts only. Response element
// of
// GET /api/commits. Mirrored 1:1 by the TS WeekSummary in libs/types/contract.ts.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.WeeklyCommit;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WeekSummary(
    UUID commitId,
    LocalDate weekStart,
    com.solovis.wcm.commit.LifecycleState lifecycleState,
    int itemCount,
    int completedCount,
    int carriedInCount) {

  /** Project a commit + its items down to the list header counts. */
  public static WeekSummary from(WeeklyCommit commit, List<CommitItem> items) {
    int completed =
        (int) items.stream().filter(i -> i.getStatus() == CommitItemStatus.COMPLETE).count();
    int carriedIn = (int) items.stream().filter(i -> i.getCarriedFromItemId() != null).count();
    return new WeekSummary(
        commit.getId(),
        commit.getWeekStart(),
        commit.getLifecycleState(),
        items.size(),
        completed,
        carriedIn);
  }
}
