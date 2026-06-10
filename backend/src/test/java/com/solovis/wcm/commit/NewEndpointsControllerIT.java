// NewEndpointsControllerIT — MockMvc tests for the endpoints added to wire the FE contract to the
// backend: GET /commits/current (204 empty + populated), GET /commits as WeekSummary headers, the
// thin Pulse (GET readable by owner OR direct manager, PUT owner-only + lifecycle freeze after
// RECONCILED), GET /review-queue (manager, flat page), the dashboard
// drill-through resolver (GET /rollup/reports/{id}/latest-commit), and GET /integration/outlook.
// Full stack against Testcontainers Postgres, authenticated via locally minted RS256 tokens (U15).
package com.solovis.wcm.commit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class NewEndpointsControllerIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;

  private Member member(String slug, MemberRole role, Member mgr) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(role)
            .managerId(mgr == null ? null : mgr.getId())
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private RequestPostProcessor asEmployee(Member m) {
    return TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
  }

  private RequestPostProcessor asManager(Member m) {
    return TestJwtConfig.manager(m.getAuth0Subject(), m.getEmail());
  }

  private WeeklyCommit commitFor(Member owner, LocalDate week, LifecycleState state) {
    return commits.saveAndFlush(
        WeeklyCommit.builder()
            .memberId(owner.getId())
            .weekStart(week)
            .lifecycleState(state)
            .build());
  }

  @Test
  void currentWeekIsNoContentWhenNone() throws Exception {
    Member m = member("noWeek", MemberRole.EMPLOYEE, null);
    mockMvc
        .perform(get("/api/commits/current").with(asEmployee(m)))
        .andExpect(status().isNoContent());
  }

  @Test
  void currentWeekReturnsMostRecentOpenWeek() throws Exception {
    Member m = member("hasWeek", MemberRole.EMPLOYEE, null);
    commitFor(m, LocalDate.parse("2026-06-01"), LifecycleState.LOCKED);
    WeeklyCommit recent = commitFor(m, LocalDate.parse("2026-06-08"), LifecycleState.DRAFT);
    mockMvc
        .perform(get("/api/commits/current").with(asEmployee(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(recent.getId().toString()))
        .andExpect(jsonPath("$.lifecycleState").value("DRAFT"));
  }

  @Test
  void listMineReturnsWeekSummaryHeaders() throws Exception {
    Member m = member("summaries", MemberRole.EMPLOYEE, null);
    WeeklyCommit wc = commitFor(m, LocalDate.parse("2026-06-08"), LifecycleState.LOCKED);
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("a")
            .status(CommitItemStatus.COMPLETE)
            .build());
    mockMvc
        .perform(get("/api/commits").with(asEmployee(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].commitId").value(wc.getId().toString()))
        .andExpect(jsonPath("$[0].itemCount").value(1))
        .andExpect(jsonPath("$[0].completedCount").value(1));
  }

  @Test
  void pulseRoundTripsForTheOwner() throws Exception {
    Member m = member("pulseOwner", MemberRole.EMPLOYEE, null);
    WeeklyCommit wc = commitFor(m, LocalDate.parse("2026-06-08"), LifecycleState.DRAFT);
    mockMvc
        .perform(get("/api/commits/" + wc.getId() + "/pulse").with(asEmployee(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(org.hamcrest.Matchers.nullValue()));
    mockMvc
        .perform(
            put("/api/commits/" + wc.getId() + "/pulse")
                .with(asEmployee(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":4,\"comment\":\"good week\",\"privateToManager\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(4))
        .andExpect(jsonPath("$.privateToManager").value(true));
  }

  @Test
  void pulseIsForbiddenForNonOwner() throws Exception {
    Member owner = member("pOwner", MemberRole.EMPLOYEE, null);
    Member other = member("pOther", MemberRole.EMPLOYEE, null);
    WeeklyCommit wc = commitFor(owner, LocalDate.parse("2026-06-08"), LifecycleState.DRAFT);
    mockMvc
        .perform(get("/api/commits/" + wc.getId() + "/pulse").with(asEmployee(other)))
        .andExpect(status().isForbidden());
  }

  @Test
  void pulseIsReadableByTheOwnersDirectManager() throws Exception {
    // The editor's privacy toggle is "Visible to your manager only" — the direct manager's review
    // screen legitimately reads the report's pulse, so the GET must not 403 for them.
    Member mgr = member("pulseMgr", MemberRole.MANAGER, null);
    Member rep = member("pulseRep", MemberRole.EMPLOYEE, mgr);
    Member strangerMgr = member("pulseStrangerMgr", MemberRole.MANAGER, null);
    WeeklyCommit wc = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.LOCKED);
    mockMvc
        .perform(
            put("/api/commits/" + wc.getId() + "/pulse")
                .with(asEmployee(rep))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":3,\"comment\":\"steady\",\"privateToManager\":true}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/commits/" + wc.getId() + "/pulse").with(asManager(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(3));
    // An unrelated manager is NOT the owner's direct manager — still 403.
    mockMvc
        .perform(get("/api/commits/" + wc.getId() + "/pulse").with(asManager(strangerMgr)))
        .andExpect(status().isForbidden());
  }

  @Test
  void pulsePutOnReconciledCommitConflicts() throws Exception {
    // Once the week is RECONCILED the commit is frozen — item edits already 409; the pulse write
    // must freeze the same way (same illegal_transition problem shape).
    Member m = member("pulseFrozen", MemberRole.EMPLOYEE, null);
    WeeklyCommit wc = commitFor(m, LocalDate.parse("2026-06-08"), LifecycleState.RECONCILED);
    mockMvc
        .perform(
            put("/api/commits/" + wc.getId() + "/pulse")
                .with(asEmployee(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":2,\"comment\":\"too late\",\"privateToManager\":false}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_transition"));
  }

  @Test
  void pulsePutWhileReconcilingSucceeds() throws Exception {
    // RECONCILING is still inside the editable window — the owner records their pulse alongside
    // their actuals.
    Member m = member("pulseRecon", MemberRole.EMPLOYEE, null);
    WeeklyCommit wc = commitFor(m, LocalDate.parse("2026-06-08"), LifecycleState.RECONCILING);
    mockMvc
        .perform(
            put("/api/commits/" + wc.getId() + "/pulse")
                .with(asEmployee(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":5,\"comment\":\"strong close\",\"privateToManager\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(5));
  }

  @Test
  void reviewQueueListsReportsForTheWeek() throws Exception {
    Member mgr = member("queueMgr", MemberRole.MANAGER, null);
    Member rep = member("queueRep", MemberRole.EMPLOYEE, mgr);
    commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.LOCKED);
    mockMvc
        .perform(
            get("/api/review-queue")
                .param("weekStart", "2026-06-08")
                .param("size", "50")
                .with(asManager(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.memberId=='%s')]".formatted(rep.getId())).exists())
        .andExpect(jsonPath("$.totalElements").value(1));
  }

  @Test
  void reviewQueueIsForbiddenForEmployees() throws Exception {
    Member emp = member("queueEmp", MemberRole.EMPLOYEE, null);
    mockMvc
        .perform(get("/api/review-queue").param("weekStart", "2026-06-08").with(asEmployee(emp)))
        .andExpect(status().isForbidden());
  }

  @Test
  void drillThroughResolvesReportsLatestReviewableCommit() throws Exception {
    Member mgr = member("drillMgr", MemberRole.MANAGER, null);
    Member rep = member("drillRep", MemberRole.EMPLOYEE, mgr);
    commitFor(rep, LocalDate.parse("2026-06-01"), LifecycleState.DRAFT); // not reviewable
    WeeklyCommit locked = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.LOCKED);
    mockMvc
        .perform(get("/api/rollup/reports/" + rep.getId() + "/latest-commit").with(asManager(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.commitId").value(locked.getId().toString()));
  }

  @Test
  void drillThroughForbidsResolvingAnUnrelatedReport() throws Exception {
    Member mgrA = member("drillMgrA", MemberRole.MANAGER, null);
    Member mgrB = member("drillMgrB", MemberRole.MANAGER, null);
    Member repB = member("drillRepB", MemberRole.EMPLOYEE, mgrB);
    commitFor(repB, LocalDate.parse("2026-06-08"), LifecycleState.LOCKED);
    mockMvc
        .perform(
            get("/api/rollup/reports/" + repB.getId() + "/latest-commit").with(asManager(mgrA)))
        .andExpect(status().isForbidden());
  }

  @Test
  void ownersManagerCanReadTheReportsCommit() throws Exception {
    Member mgr = member("readMgr", MemberRole.MANAGER, null);
    Member rep = member("readRep", MemberRole.EMPLOYEE, mgr);
    Member stranger = member("readStranger", MemberRole.MANAGER, null);
    WeeklyCommit wc = commitFor(rep, LocalDate.parse("2026-06-08"), LifecycleState.LOCKED);
    // The owner's manager can read it (manager review-detail screen) ...
    mockMvc
        .perform(get("/api/commits/" + wc.getId()).with(asManager(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(wc.getId().toString()));
    // ... but an unrelated manager cannot.
    mockMvc
        .perform(get("/api/commits/" + wc.getId()).with(asManager(stranger)))
        .andExpect(status().isForbidden());
  }

  @Test
  void outlookConnectionDefaultsToDisconnected() throws Exception {
    Member m = member("outlookUser", MemberRole.EMPLOYEE, null);
    mockMvc
        .perform(get("/api/integration/outlook").with(asEmployee(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DISCONNECTED"))
        .andExpect(jsonPath("$.createEventOnLock").value(true));
  }
}
