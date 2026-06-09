// InputValidationIT — regression coverage for the request-validation fix wave (findings #9, #15):
// an over-length Pulse comment must be rejected as a 400 validation_failed (PulseRequest @Size on
// the pulse_reading.comment varchar(2000) column) instead of a misleading 409 constraint_violation,
// and GET /api/rollup pagination must reject out-of-range page/size (page < 0, size 0, size > cap)
// as a 400 rather than silently coercing them. Also asserts the happy paths (valid pulse, valid
// rollup page) still succeed. Full stack against the shared Testcontainers Postgres; every commit
// created here uses a Monday weekStart and links its item to a really-persisted SupportingOutcome,
// per project convention.
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
import com.solovis.wcm.rcdo.DefiningObjective;
import com.solovis.wcm.rcdo.Outcome;
import com.solovis.wcm.rcdo.RallyCry;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class InputValidationIT extends AbstractWebIT {

  /** A Monday — weekStart must be a Monday per the project convention. */
  private static final LocalDate MONDAY = LocalDate.parse("2026-06-08");

  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;
  @Autowired private RcdoRepository rcdo;

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

  /** Persist a real RCDO chain and return the leaf SupportingOutcome id to link commit items to. */
  private UUID seedSupportingOutcome() {
    var rally = rcdo.save(RallyCry.builder().title("RC").build());
    var objective =
        rcdo.save(DefiningObjective.builder().rallyCryId(rally.getId()).title("DO").build());
    Outcome outcome =
        rcdo.save(Outcome.builder().definingObjectiveId(objective.getId()).title("O").build());
    return rcdo.save(SupportingOutcome.builder().outcomeId(outcome.getId()).title("SO").build())
        .getId();
  }

  /**
   * A Monday-week commit with one item linked to a real SupportingOutcome (convention-compliant).
   */
  private WeeklyCommit linkedCommitFor(Member owner, LifecycleState state) {
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(owner.getId())
                .weekStart(MONDAY)
                .lifecycleState(state)
                .build());
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("task")
            .status(CommitItemStatus.COMPLETE)
            .supportingOutcomeId(seedSupportingOutcome())
            .chessTier(ChessTier.ROOK)
            .build());
    return wc;
  }

  // ---------------------------------------------------------------------------
  // Finding #9 — over-length Pulse comment must be 400 validation_failed, not 409.
  // ---------------------------------------------------------------------------

  @Test
  void overLengthPulseCommentIsBadRequestNotConflict() throws Exception {
    Member owner = member("pulseTooLong", MemberRole.EMPLOYEE, null);
    WeeklyCommit wc = linkedCommitFor(owner, LifecycleState.DRAFT);
    String tooLong = "x".repeat(2001); // pulse_reading.comment is varchar(2000)
    String body =
        objectMapper.writeValueAsString(
            new java.util.LinkedHashMap<>() {
              {
                put("rating", 4);
                put("comment", tooLong);
                put("privateToManager", false);
              }
            });

    mockMvc
        .perform(
            put("/api/commits/" + wc.getId() + "/pulse")
                .with(asEmployee(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("validation_failed"))
        // The @Size message renders cleanly ("comment must be ..."), not as a 409 conflict detail.
        .andExpect(
            jsonPath("$.detail")
                .value(org.hamcrest.Matchers.startsWith("comment must be at most")));
  }

  @Test
  void validPulseCommentSucceeds() throws Exception {
    Member owner = member("pulseOk", MemberRole.EMPLOYEE, null);
    WeeklyCommit wc = linkedCommitFor(owner, LifecycleState.DRAFT);
    String maxLen = "y".repeat(2000); // exactly at the column bound — must be accepted

    mockMvc
        .perform(
            put("/api/commits/" + wc.getId() + "/pulse")
                .with(asEmployee(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"rating\":3,\"comment\":\"" + maxLen + "\",\"privateToManager\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(3));
  }

  // ---------------------------------------------------------------------------
  // Finding #15 — out-of-range rollup pagination must be 400, not silently coerced.
  // ---------------------------------------------------------------------------

  @Test
  void negativePageIsBadRequest() throws Exception {
    Member mgr = member("validMgrNeg", MemberRole.MANAGER, null);
    mockMvc
        .perform(get("/api/rollup").param("page", "-1").with(asManager(mgr)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void zeroSizeIsBadRequest() throws Exception {
    Member mgr = member("validMgrZero", MemberRole.MANAGER, null);
    mockMvc
        .perform(get("/api/rollup").param("size", "0").with(asManager(mgr)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void oversizeSizeIsBadRequest() throws Exception {
    Member mgr = member("validMgrBig", MemberRole.MANAGER, null);
    mockMvc
        .perform(get("/api/rollup").param("size", "99999").with(asManager(mgr)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void validRollupPageSucceeds() throws Exception {
    Member mgr = member("validMgrOk", MemberRole.MANAGER, null);
    member("validRep", MemberRole.EMPLOYEE, mgr);
    mockMvc
        .perform(get("/api/rollup").param("page", "0").param("size", "50").with(asManager(mgr)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.size").value(50))
        .andExpect(jsonPath("$.number").value(0));
  }
}
