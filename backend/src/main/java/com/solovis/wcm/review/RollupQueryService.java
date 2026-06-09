// RollupQueryService — the manager team roll-up read model (U14). Filters STRICTLY to the acting
// manager's direct reports (row-level authz, KTD6 — the manager id comes from
// CurrentMemberProvider,
// never a client param), so manager A can never see manager B's reports. Pageable (capped at 2000)
// over the reports; per report computes completionPct, carryOverRate and rcdoAlignmentPct from that
// report's commit items. RCDO-alignment = items linked to a resolvable SupportingOutcome / total.
package com.solovis.wcm.review;

import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import com.solovis.wcm.review.dto.RollupRow;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RollupQueryService {

  /** Brief NFR: a roll-up page must never exceed 2000 rows. */
  public static final int MAX_PAGE_SIZE = 2000;

  private final MemberRepository members;
  private final WeeklyCommitRepository commits;
  private final CommitItemRepository items;
  private final RcdoRepository rcdo;
  private final CurrentMemberProvider currentMember;

  public RollupQueryService(
      MemberRepository members,
      WeeklyCommitRepository commits,
      CommitItemRepository items,
      RcdoRepository rcdo,
      CurrentMemberProvider currentMember) {
    this.members = members;
    this.commits = commits;
    this.items = items;
    this.rcdo = rcdo;
    this.currentMember = currentMember;
  }

  /**
   * GET /rollup — a page of the acting manager's reports with their metrics. The report set is
   * derived from the acting manager id (never a param), so cross-manager reads return only the
   * caller's own reports. Page size is capped at {@link #MAX_PAGE_SIZE}. Reports are sorted by a
   * STABLE total order (display name, then id) BEFORE paging so page boundaries are deterministic
   * across the brief's 2000-record requirement (two reports with the same display name still order
   * consistently by their unique id). The caller wraps the returned Page in a PagedModel so Jackson
   * serializes a stable page shape rather than a raw PageImpl.
   */
  @Transactional(readOnly = true)
  public Page<RollupRow> rollup(Pageable pageable) {
    UUID managerId = currentMember.currentMemberId();
    List<Member> reports =
        members.findByManagerId(managerId).stream().sorted(STABLE_REPORT_ORDER).toList();

    int pageSize = Math.min(pageable.getPageSize(), MAX_PAGE_SIZE);
    int from = (int) Math.min((long) pageable.getPageNumber() * pageSize, reports.size());
    int to = (int) Math.min((long) from + pageSize, reports.size());
    List<Member> pageReports = reports.subList(from, to);

    // Batch-load this PAGE's data in a fixed number of queries (no per-report / per-commit round
    // trips): commits for all page reports, then items for all those commits, then the valid RCDO
    // SupportingOutcome ids once. This keeps the roll-up read O(few queries) at the 2000-record
    // ceiling (NFR <200ms) instead of O(reports * commits) — identical metrics, far fewer queries.
    List<UUID> reportIds = pageReports.stream().map(Member::getId).toList();
    Map<UUID, List<WeeklyCommit>> commitsByMember =
        reportIds.isEmpty()
            ? Map.of()
            : commits.findByMemberIdIn(reportIds).stream()
                .collect(Collectors.groupingBy(WeeklyCommit::getMemberId));
    List<UUID> commitIds =
        commitsByMember.values().stream().flatMap(List::stream).map(WeeklyCommit::getId).toList();
    Map<UUID, List<CommitItem>> itemsByCommit =
        commitIds.isEmpty()
            ? Map.of()
            : items.findByWeeklyCommitIdIn(commitIds).stream()
                .collect(Collectors.groupingBy(CommitItem::getWeeklyCommitId));
    Set<UUID> validOutcomeIds =
        rcdo.findAllSupportingOutcomes().stream()
            .map(SupportingOutcome::getId)
            .collect(Collectors.toSet());

    List<RollupRow> rows =
        pageReports.stream()
            .map(
                r ->
                    rowFor(
                        r,
                        commitsByMember.getOrDefault(r.getId(), List.of()),
                        itemsByCommit,
                        validOutcomeIds))
            .toList();
    return new PageImpl<>(rows, pageable, reports.size());
  }

  /**
   * Resolve the commit a dashboard drill-through should open for {@code reportId}: that report's
   * most recent reviewable (LOCKED or later) commit. Row-level authorized — the report MUST be a
   * direct report of the acting manager (403 otherwise, KTD6) — so a manager can only drill into
   * their own reports. 404 when the report has no reviewable week yet. This is the backend half of
   * the deferred "dashboard drill-through navigates to the queue instead of the report's review"
   * fix.
   */
  @Transactional(readOnly = true)
  public UUID latestReviewableCommitId(UUID reportId) {
    UUID managerId = currentMember.currentMemberId();
    Member report =
        members
            .findById(reportId)
            .orElseThrow(() -> new ResourceNotFoundException("member " + reportId + " not found"));
    if (!Objects.equals(report.getManagerId(), managerId)) {
      throw new ForbiddenException("member " + reportId + " is not a report of the acting manager");
    }
    return commits.findByMemberId(reportId).stream()
        .filter(c -> c.getLifecycleState() != LifecycleState.DRAFT)
        .max(Comparator.comparing(WeeklyCommit::getWeekStart))
        .map(WeeklyCommit::getId)
        .orElseThrow(
            () -> new ResourceNotFoundException("report " + reportId + " has no reviewable week"));
  }

  /** Stable total order for reports: display name (case-insensitive), then the unique id. */
  private static final Comparator<Member> STABLE_REPORT_ORDER =
      Comparator.comparing(
              Member::getDisplayName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
          .thenComparing(Member::getId);

  /**
   * Build one report's row from PRE-LOADED page data (no further queries). Metrics are identical to
   * the prior per-report computation: completion = COMPLETE/total, carry-over = CARRIED_FORWARD/
   * total, alignment = items whose SupportingOutcome id resolves in the live RCDO tree / total.
   */
  private RollupRow rowFor(
      Member report,
      List<WeeklyCommit> reportCommits,
      Map<UUID, List<CommitItem>> itemsByCommit,
      Set<UUID> validOutcomeIds) {
    List<CommitItem> allItems =
        reportCommits.stream()
            .flatMap(c -> itemsByCommit.getOrDefault(c.getId(), List.of()).stream())
            .toList();

    int total = allItems.size();
    long complete =
        allItems.stream().filter(i -> i.getStatus() == CommitItemStatus.COMPLETE).count();
    long carried =
        allItems.stream().filter(i -> i.getStatus() == CommitItemStatus.CARRIED_FORWARD).count();
    long aligned = allItems.stream().filter(i -> isRcdoAligned(i, validOutcomeIds)).count();

    return new RollupRow(
        report.getId(),
        report.getDisplayName(),
        reportCommits.size(),
        total,
        pct(complete, total),
        pct(carried, total),
        pct(aligned, total));
  }

  /** Aligned = linked to a SupportingOutcome that resolves in the live RCDO tree (active path). */
  private static boolean isRcdoAligned(CommitItem item, Set<UUID> validOutcomeIds) {
    return item.getSupportingOutcomeId() != null
        && validOutcomeIds.contains(item.getSupportingOutcomeId());
  }

  private static double pct(long numerator, int total) {
    return total == 0 ? 0.0 : (numerator * 100.0) / total;
  }
}
