// RollupControllerIT — MockMvc tests for the manager review write + team roll-up (U14), full stack
// against Testcontainers Postgres, AUTHENTICATED via locally minted RS256 manager tokens (U15) that
// carry the reconcile:commits permission required by these manager-only routes. Proves: roll-up
// rows carry correct completion/carry-over/RCDO-alignment metrics; manager A canNOT see manager B's
// reports (row-level authz, KTD6); Pageable page boundaries; a REVIEWED write on a RECONCILED
// commit
// succeeds for the owner's manager (stamping the commit reviewer/reviewedAt and the ManagerReview)
// but is 403 for an unrelated (but still scoped) manager; and a review is rejected (409) before the
// IC reconciles — a never-submitted DRAFT and a not-yet-reconciled LOCKED commit both 409.
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
  @Autowired private ManagerReviewRepository reviews;

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

    // Page 0, size 2 -> 2 rows, totalElements 5. The FLAT PageResponse envelope (matching the FE's
    // TS Page<T> contract) carries totalElements/size/number at the TOP level (not nested under
    // "page" like Spring's PagedModel) — the deliberate shape change the dashboard reads directly.
    mockMvc
        .perform(get("/api/rollup").param("page", "0").param("size", "2").with(as(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2))
        .andExpect(jsonPath("$.totalElements").value(5))
        .andExpect(jsonPath("$.totalPages").value(3))
        .andExpect(jsonPath("$.size").value(2))
        .andExpect(jsonPath("$.number").value(0));

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
  void reviewedWriteOnReconciledStampsCommitAndIsForbiddenForOthers() throws Exception {
    Member mgr = manager("revMgr");
    Member other = manager("revOther");
    Member rep = report("revRep", mgr);
    // The IC has reconciled their week; the manager now reviews it (the separate, after-the-fact
    // step).
    WeeklyCommit wc = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.RECONCILED);

    // The owner's manager may review; a REVIEWED write stamps the commit and the ManagerReview.
    mockMvc
        .perform(
            post("/api/commits/{id}/review", wc.getId())
                .with(as(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"REVIEWED\",\"comment\":\"great work\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.reviewerId").value(mgr.getId().toString()))
        .andExpect(jsonPath("$.state").value("REVIEWED"));

    // The ManagerReview is REVIEWED and the commit is stamped reviewer/reviewedAt by ReviewService.
    var review = reviews.findByWeeklyCommitId(wc.getId()).orElseThrow();
    org.assertj.core.api.Assertions.assertThat(review.getState()).isEqualTo(ReviewState.REVIEWED);
    WeeklyCommit reviewed = commits.findById(wc.getId()).orElseThrow();
    org.assertj.core.api.Assertions.assertThat(reviewed.getReviewerId()).isEqualTo(mgr.getId());
    org.assertj.core.api.Assertions.assertThat(reviewed.getReviewedAt()).isNotNull();

    // An unrelated manager may not (authz fails before the state check).
    mockMvc
        .perform(
            post("/api/commits/{id}/review", wc.getId())
                .with(as(other))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"REVIEWED\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void reviewOnNeverSubmittedDraftIsConflict() throws Exception {
    // A DRAFT was never submitted/reconciled — there is no reconciled week to review. The lifecycle
    // guard must reject with 409 illegal_state (problem+json), even though the acting manager is
    // the
    // owner's manager (so it is NOT a 403/authorization failure — it is a state failure).
    Member mgr = manager("draftMgr");
    Member rep = report("draftRep", mgr);
    WeeklyCommit wc = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.DRAFT);

    mockMvc
        .perform(
            post("/api/commits/{id}/review", wc.getId())
                .with(as(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"REVIEWED\",\"comment\":\"too soon\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_state"));
  }

  @Test
  void managerCannotReviewBeforeTheIcReconciles() throws Exception {
    // Regression: the manager reviews AFTER the IC reconciles. A LOCKED (submitted but not yet
    // reconciled) commit is NOT reviewable — the manager's review there is premature and must 409
    // illegal_state, not be silently accepted. Authz passes (the owner's manager), so this is a
    // pure
    // state failure.
    Member mgr = manager("earlyMgr");
    Member rep = report("earlyRep", mgr);
    WeeklyCommit wc = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.LOCKED);

    mockMvc
        .perform(
            post("/api/commits/{id}/review", wc.getId())
                .with(as(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"REVIEWED\",\"comment\":\"too early\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_state"));

    // RECONCILING is likewise not yet reconciled by the owner -> also 409.
    WeeklyCommit reconciling =
        commitFor(rep, LocalDate.parse("2026-06-15"), LifecycleState.RECONCILING);
    mockMvc
        .perform(
            post("/api/commits/{id}/review", reconciling.getId())
                .with(as(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"REVIEWED\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_state"));
  }
}
