// ReviewQueueService — the manager review-queue read model (U21). For a selected week, returns the
// acting manager's DIRECT REPORTS (row-level: the manager id comes from CurrentMemberProvider,
// never
// a param — KTD6) each with their commit for that week (if any), its state, overdue flag, item /
// completed counts, and the manager-review state. Pageable, size capped at 2000 (brief NFR),
// reports
// in a STABLE order (display name, then id) so page boundaries are deterministic.
package com.solovis.wcm.review;

import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.review.dto.ReviewQueueRow;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewQueueService {

  /** Brief NFR: a page must never exceed 2000 rows. */
  public static final int MAX_PAGE_SIZE = 2000;

  private final MemberRepository members;
  private final WeeklyCommitRepository commits;
  private final CommitItemRepository items;
  private final ManagerReviewRepository reviews;
  private final CurrentMemberProvider currentMember;

  public ReviewQueueService(
      MemberRepository members,
      WeeklyCommitRepository commits,
      CommitItemRepository items,
      ManagerReviewRepository reviews,
      CurrentMemberProvider currentMember) {
    this.members = members;
    this.commits = commits;
    this.items = items;
    this.reviews = reviews;
    this.currentMember = currentMember;
  }

  private static final Comparator<Member> STABLE_REPORT_ORDER =
      Comparator.comparing(
              Member::getDisplayName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
          .thenComparing(Member::getId);

  /**
   * GET /review-queue — a page of the acting manager's reports' submission status for {@code week}.
   * When {@code week} is null the most recent activity isn't assumed; callers always pass a week
   * (the UI's WeekSelector), but a null is treated as "this Monday" defensively.
   */
  @Transactional(readOnly = true)
  public Page<ReviewQueueRow> queue(LocalDate week, Pageable pageable) {
    UUID managerId = currentMember.currentMemberId();
    LocalDate target = week != null ? week : mondayOf(LocalDate.now());
    List<Member> reports =
        members.findByManagerId(managerId).stream().sorted(STABLE_REPORT_ORDER).toList();

    int pageSize = Math.min(pageable.getPageSize(), MAX_PAGE_SIZE);
    int from = (int) Math.min((long) pageable.getPageNumber() * pageSize, reports.size());
    int to = (int) Math.min((long) from + pageSize, reports.size());

    List<ReviewQueueRow> rows =
        reports.subList(from, to).stream().map(r -> rowFor(r, target)).toList();
    return new PageImpl<>(rows, pageable, reports.size());
  }

  private ReviewQueueRow rowFor(Member report, LocalDate week) {
    Optional<WeeklyCommit> commit = commits.findByMemberIdAndWeekStart(report.getId(), week);
    if (commit.isEmpty()) {
      return new ReviewQueueRow(
          report.getId(), report.getDisplayName(), null, null, false, 0, 0, ReviewState.UNREVIEWED);
    }
    WeeklyCommit c = commit.get();
    List<CommitItem> its = items.findByWeeklyCommitId(c.getId());
    int completed =
        (int) its.stream().filter(i -> i.getStatus() == CommitItemStatus.COMPLETE).count();
    ReviewState reviewState =
        reviews
            .findByWeeklyCommitId(c.getId())
            .map(ManagerReview::getState)
            .orElse(ReviewState.UNREVIEWED);
    return new ReviewQueueRow(
        report.getId(),
        report.getDisplayName(),
        c.getId(),
        c.getLifecycleState(),
        isOverdue(c),
        its.size(),
        completed,
        reviewState);
  }

  /** A week is overdue when still a DRAFT and its Friday (end of day, UTC) is in the past. */
  private static boolean isOverdue(WeeklyCommit commit) {
    if (commit.getLifecycleState() != LifecycleState.DRAFT) {
      return false;
    }
    LocalDate friday = commit.getWeekStart().plusDays(4);
    return friday.atTime(23, 59, 59).toInstant(ZoneOffset.UTC).isBefore(java.time.Instant.now());
  }

  private static LocalDate mondayOf(LocalDate day) {
    return day.with(
        java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
  }
}
