// OutlookScheduleIT — full-stack MockMvc tests for CB-1's POST /api/integration/outlook/schedule
// (manager schedules an Outlook event with a report). Runs on AbstractWebIT with the
// StubCalendarAdapter active (test profile != graph), proving: route gate (MANAGER_SCOPE),
// row-level authz (acting manager must BE the report's manager), the connected-precondition
// (409 illegal_state without a GraphToken row), subject/duration defaulting, bean validation,
// and that the stub port records the right ScheduledEventCommand.
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class OutlookScheduleIT extends AbstractWebIT {

  private static final String SCHEDULE_URL = "/api/integration/outlook/schedule";

  @Autowired private MemberRepository members;
  @Autowired private GraphTokenRepository tokens;
  @Autowired private StubCalendarAdapter stub;

  // --- seeding helpers ---------------------------------------------------------------------

  private Member manager(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.MANAGER)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private Member reportOf(Member boss, String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .managerId(boss.getId())
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  /** Seed the GraphToken row that GraphTokenService.isConnected keys on (presence == connected). */
  private void connectOutlook(Member m) {
    tokens.saveAndFlush(
        GraphToken.builder()
            .memberId(m.getId())
            .accessTokenEnc("enc-access")
            .refreshTokenEnc("enc-refresh")
            .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
            .build());
  }

  private RequestPostProcessor asManager(Member m) {
    return TestJwtConfig.manager(m.getAuth0Subject(), m.getEmail());
  }

  private RequestPostProcessor asEmployee(Member m) {
    return TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
  }

  private String body(UUID reportMemberId, String subject, Integer durationMinutes)
      throws Exception {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("reportMemberId", reportMemberId);
    if (subject != null) {
      map.put("subject", subject);
    }
    map.put("startDateTime", OffsetDateTime.of(2026, 6, 15, 10, 0, 0, 0, ZoneOffset.ofHours(-5)));
    if (durationMinutes != null) {
      map.put("durationMinutes", durationMinutes);
    }
    map.put("note", "agenda: pipeline + blockers");
    return objectMapper.writeValueAsString(map);
  }

  // --- tests -------------------------------------------------------------------------------

  @Test
  void managerSchedulesForOwnReport() throws Exception {
    Member mgr = manager("schedMgr");
    connectOutlook(mgr);
    Member rpt = reportOf(mgr, "schedRpt");
    int before = stub.scheduledCount();

    mockMvc
        .perform(
            post(SCHEDULE_URL)
                .with(asManager(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(rpt.getId(), "Pipeline sync", 45)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.eventId", Matchers.startsWith("stub-scheduled-")));

    assertThat(stub.scheduledCount()).isEqualTo(before + 1);
    ScheduledEventCommand cmd = stub.lastScheduled();
    assertThat(cmd.organizerMemberId()).isEqualTo(mgr.getId());
    assertThat(cmd.reportEmail()).isEqualTo(rpt.getEmail());
    assertThat(cmd.reportDisplayName()).isEqualTo(rpt.getDisplayName());
    assertThat(cmd.subject()).isEqualTo("Pipeline sync");
    assertThat(cmd.durationMinutes()).isEqualTo(45);
    assertThat(cmd.note()).isEqualTo("agenda: pipeline + blockers");
  }

  @Test
  void blankSubjectDefaultsToOneOnOneAndNullDurationDefaultsTo30() throws Exception {
    Member mgr = manager("schedDefaultsMgr");
    connectOutlook(mgr);
    Member rpt = reportOf(mgr, "schedDefaultsRpt");

    mockMvc
        .perform(
            post(SCHEDULE_URL)
                .with(asManager(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(rpt.getId(), "   ", null)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.eventId", Matchers.startsWith("stub-scheduled-")));

    ScheduledEventCommand cmd = stub.lastScheduled();
    assertThat(cmd.subject()).isEqualTo("1:1 — " + rpt.getDisplayName());
    assertThat(cmd.durationMinutes()).isEqualTo(30);
  }

  @Test
  void managerCannotScheduleForAnotherManagersReport() throws Exception {
    Member mgrA = manager("schedMgrA");
    connectOutlook(mgrA);
    Member mgrB = manager("schedMgrB");
    Member rptOfB = reportOf(mgrB, "schedRptOfB");
    int before = stub.scheduledCount();

    mockMvc
        .perform(
            post(SCHEDULE_URL)
                .with(asManager(mgrA))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(rptOfB.getId(), "Sneaky 1:1", 30)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));

    assertThat(stub.scheduledCount()).isEqualTo(before);
  }

  @Test
  void employeeCallerIsRejectedByTheRouteGate() throws Exception {
    Member mgr = manager("schedGateMgr");
    Member rpt = reportOf(mgr, "schedGateRpt");

    mockMvc
        .perform(
            post(SCHEDULE_URL)
                .with(asEmployee(rpt))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(rpt.getId(), "Self-schedule", 30)))
        .andExpect(status().isForbidden());
  }

  @Test
  void unknownReportIs404() throws Exception {
    Member mgr = manager("sched404Mgr");
    connectOutlook(mgr);

    mockMvc
        .perform(
            post(SCHEDULE_URL)
                .with(asManager(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(UUID.randomUUID(), "Ghost 1:1", 30)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("not_found"));
  }

  @Test
  void notConnectedManagerGets409IllegalState() throws Exception {
    // No GraphToken row for this manager — isConnected is false, so scheduling must 409.
    Member mgr = manager("schedNoTokenMgr");
    Member rpt = reportOf(mgr, "schedNoTokenRpt");
    int before = stub.scheduledCount();

    mockMvc
        .perform(
            post(SCHEDULE_URL)
                .with(asManager(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(rpt.getId(), "Premature 1:1", 30)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_state"));

    assertThat(stub.scheduledCount()).isEqualTo(before);
  }

  @Test
  void invalidDurationIs400() throws Exception {
    Member mgr = manager("schedBadDurMgr");
    connectOutlook(mgr);
    Member rpt = reportOf(mgr, "schedBadDurRpt");

    mockMvc
        .perform(
            post(SCHEDULE_URL)
                .with(asManager(mgr))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(rpt.getId(), "Too short", 10)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("validation_failed"));
  }
}
