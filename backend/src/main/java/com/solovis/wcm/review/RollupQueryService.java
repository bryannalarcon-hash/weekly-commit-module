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
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.review.dto.RollupRow;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
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

    List<RollupRow> rows = reports.subList(from, to).stream().map(this::rowFor).toList();
    return new PageImpl<>(rows, pageable, reports.size());
  }

  /** Stable total order for reports: display name (case-insensitive), then the unique id. */
  private static final Comparator<Member> STABLE_REPORT_ORDER =
      Comparator.comparing(
              Member::getDisplayName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
          .thenComparing(Member::getId);

  private RollupRow rowFor(Member report) {
    List<WeeklyCommit> reportCommits = commits.findByMemberId(report.getId());
    List<CommitItem> allItems =
        reportCommits.stream()
            .flatMap(c -> items.findByWeeklyCommitId(c.getId()).stream())
            .toList();

    int total = allItems.size();
    long complete =
        allItems.stream().filter(i -> i.getStatus() == CommitItemStatus.COMPLETE).count();
    long carried =
        allItems.stream().filter(i -> i.getStatus() == CommitItemStatus.CARRIED_FORWARD).count();
    long aligned = allItems.stream().filter(this::isRcdoAligned).count();

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
  private boolean isRcdoAligned(CommitItem item) {
    return item.getSupportingOutcomeId() != null
        && rcdo.findSupportingOutcome(item.getSupportingOutcomeId()).isPresent();
  }

  private static double pct(long numerator, int total) {
    return total == 0 ? 0.0 : (numerator * 100.0) / total;
  }
}
