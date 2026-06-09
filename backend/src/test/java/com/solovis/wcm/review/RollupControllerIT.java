// RollupControllerIT — MockMvc tests for the manager review write + team roll-up (U14), full stack
// against Testcontainers Postgres, AUTHENTICATED via locally minted RS256 manager tokens (U15) that
// carry the reconcile:commits permission required by these manager-only routes. Proves: roll-up
// rows carry correct completion/carry-over/RCDO-alignment metrics; manager A canNOT see manager B's
// reports (row-level authz, KTD6); Pageable page boundaries; and a review write succeeds for the
// owner's manager but is 403 for an unrelated (but still scoped) manager.
package com.solovis.wcm.review;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import com.solovis.wcm.rcdo.Outcome;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class RollupControllerIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;
  @Autowired private RcdoRepository rcdo;

  private Member manager(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.MANAGER)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  /** A manager bearer token (carries reconcile:commits) whose subject is the member's subject. */
  private RequestPostProcessor as(Member m) {
    return TestJwtConfig.manager(m.getAuth0Subject(), m.getEmail());
  }

  private Member report(String slug, Member mgr) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .managerId(mgr.getId())
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private UUID seedSupportingOutcome() {
    var rally = rcdo.save(com.solovis.wcm.rcdo.RallyCry.builder().title("RC").build());
    var objective =
        rcdo.save(
            com.solovis.wcm.rcdo.DefiningObjective.builder()
                .rallyCryId(rally.getId())
                .title("DO")
                .build());
    Outcome outcome =
        rcdo.save(Outcome.builder().definingObjectiveId(objective.getId()).title("O").build());
    return rcdo.save(SupportingOutcome.builder().outcomeId(outcome.getId()).title("SO").build())
        .getId();
  }

  private WeeklyCommit commitFor(Member owner, LocalDate week, LifecycleState state) {
    return commits.saveAndFlush(
        WeeklyCommit.builder()
            .memberId(owner.getId())
            .weekStart(week)
            .lifecycleState(state)
            .build());
  }

  private void item(WeeklyCommit wc, CommitItemStatus status, boolean linked) {
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("task")
            .status(status)
            .supportingOutcomeId(linked ? seedSupportingOutcome() : null)
            .chessTier(ChessTier.ROOK)
            .build());
  }

  @Test
  void rollupMetricsAreCorrect() throws Exception {
    Member mgr = manager("mgrA");
    Member rep = report("repA", mgr);
    WeeklyCommit wc = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.RECONCILED);
    // 4 items: 2 COMPLETE, 1 INCOMPLETE, 1 CARRIED_FORWARD; 3 linked -> 75% aligned.
    item(wc, CommitItemStatus.COMPLETE, true);
    item(wc, CommitItemStatus.COMPLETE, true);
    item(wc, CommitItemStatus.INCOMPLETE, true);
    item(wc, CommitItemStatus.CARRIED_FORWARD, false);

    mockMvc
        .perform(get("/api/rollup").with(as(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].memberId").value(rep.getId().toString()))
        .andExpect(jsonPath("$.content[0].itemCount").value(4))
        .andExpect(jsonPath("$.content[0].completionPct").value(50.0))
        .andExpect(jsonPath("$.content[0].carryOverRate").value(25.0))
        .andExpect(jsonPath("$.content[0].rcdoAlignmentPct").value(75.0));
  }

  @Test
  void managerCannotSeeAnotherManagersReports() throws Exception {
    Member mgrA = manager("isoA");
    Member mgrB = manager("isoB");
    Member repA = report("repIsoA", mgrA);
    Member repB = report("repIsoB", mgrB);
    commitFor(repA, LocalDate.parse("2026-06-08"), LifecycleState.DRAFT);
    commitFor(repB, LocalDate.parse("2026-06-08"), LifecycleState.DRAFT);

    // Manager A sees only repA; never repB.
    mockMvc
        .perform(get("/api/rollup").with(as(mgrA)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.memberId=='%s')]".formatted(repA.getId())).exists())
        .andExpect(
            jsonPath("$.content[?(@.memberId=='%s')]".formatted(repB.getId())).doesNotExist());
  }

  @Test
  void pageableBoundariesAreHonored() throws Exception {
    Member mgr = manager("pageMgr");
    for (int i = 0; i < 5; i++) {
      report("pageRep" + i, mgr);
    }

    // Page 0, size 2 -> 2 rows, totalElements 5. PagedModel nests paging metadata under "page".
    mockMvc
        .perform(get("/api/rollup").param("page", "0").param("size", "2").with(as(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2))
        .andExpect(jsonPath("$.page.totalElements").value(5))
        .andExpect(jsonPath("$.page.size").value(2))
        .andExpect(jsonPath("$.page.number").value(0));

    // Page 2, size 2 -> the trailing single row.
    mockMvc
        .perform(get("/api/rollup").param("page", "2").param("size", "2").with(as(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  @Test
  void reportsAreReturnedInAStableNameThenIdOrderAcrossPages() throws Exception {
    // Deferred fix: a stable sort (display name, then id) makes page boundaries deterministic so
    // the
    // same record never appears on two pages / goes missing across the 2000-record requirement.
    Member mgr = manager("sortMgr");
    report("Zoe", mgr);
    report("Ada", mgr);
    report("Mia", mgr);

    mockMvc
        .perform(get("/api/rollup").param("page", "0").param("size", "3").with(as(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].memberName").value("Ada"))
        .andExpect(jsonPath("$.content[1].memberName").value("Mia"))
        .andExpect(jsonPath("$.content[2].memberName").value("Zoe"));
  }

  @Test
  void reviewWriteSucceedsForOwnersManagerAndIsForbiddenForOthers() throws Exception {
    Member mgr = manager("revMgr");
    Member other = manager("revOther");
    Member rep = report("revRep", mgr);
    WeeklyCommit wc = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.RECONCILING);

    // The owner's manager may review.
    mockMvc
        .perform(
            post("/api/commits/{id}/review", wc.getId())
                .with(as(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"INCOMPLETE\",\"comment\":\"keep going\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.reviewerId").value(mgr.getId().toString()))
        .andExpect(jsonPath("$.state").value("INCOMPLETE"));

    // An unrelated manager may not.
    mockMvc
        .perform(
            post("/api/commits/{id}/review", wc.getId())
                .with(as(other))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"REVIEWED\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }
}
