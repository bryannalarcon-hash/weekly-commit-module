// CommitWriteCorrectnessIT — full-stack MockMvc regression tests for the commit-write fix wave.
// Covers: (#1) a non-existent / wrong-tier supportingOutcomeId is rejected at the APPLICATION layer
// as 404 not_found (NOT the misleading 409 constraint_violation that the DB FK used to surface);
// (#2/#3/#5) a non-Monday weekStart is a 400 validation error so the member+week unique constraint
// cannot be bypassed; (#13) the rendered range/Monday detail does not double the field name; and
// (#12) submitting a ZERO-item commit returns the "at least one item" 422 message, not the vacuous
// "every item must link" one. Authenticated via locally minted RS256 tokens like
// CommitControllerIT.
package com.solovis.wcm.commit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

class CommitWriteCorrectnessIT extends AbstractWebIT {

  // 2026-06-08 is a Monday (the project rule); the day after is a non-Monday in-week date.
  private static final String MONDAY = "2026-06-08";
  private static final String TUESDAY = "2026-06-09";

  @Autowired private MemberRepository members;
  @Autowired private RcdoRepository rcdo;
  @Autowired private WeeklyCommitRepository commits;

  private Member member(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private RequestPostProcessor as(Member m) {
    return TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
  }

  /** Seed a full RCDO path and return a real, linkable SupportingOutcome (leaf) id. */
  private UUID seedSupportingOutcome() {
    RallyCry rally = rcdo.save(RallyCry.builder().title("RC " + UUID.randomUUID()).build());
    DefiningObjective objective =
        rcdo.save(DefiningObjective.builder().rallyCryId(rally.getId()).title("DO").build());
    Outcome outcome =
        rcdo.save(Outcome.builder().definingObjectiveId(objective.getId()).title("O").build());
    SupportingOutcome so =
        rcdo.save(SupportingOutcome.builder().outcomeId(outcome.getId()).title("SO").build());
    return so.getId();
  }

  // --- Finding #1: bad supportingOutcomeId -> 404 not_found (application-layer) ----------------

  @Test
  void createWithNonexistentSupportingOutcomeIsNotFound() throws Exception {
    Member alice = member("alice-bad-link");
    UUID ghost = UUID.randomUUID(); // never persisted
    String body =
        """
        {"weekStart":"%s","items":[{"text":"ship it","supportingOutcomeId":"%s","chessTier":"KING"}]}
        """
            .formatted(MONDAY, ghost);

    mockMvc
        .perform(
            post("/api/commits")
                .with(as(alice))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("not_found"))
        .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("supporting")));
  }

  @Test
  void createWithNonLeafRcdoIdIsNotFound() throws Exception {
    // A wrong-tier (non-leaf) id — here an Outcome id, not a SupportingOutcome — must be rejected:
    // findSupportingOutcome queries only supporting_outcome, so leaf-ness is enforced
    // automatically.
    Member bob = member("bob-wrong-tier");
    RallyCry rally = rcdo.save(RallyCry.builder().title("RC " + UUID.randomUUID()).build());
    DefiningObjective objective =
        rcdo.save(DefiningObjective.builder().rallyCryId(rally.getId()).title("DO").build());
    Outcome outcome =
        rcdo.save(Outcome.builder().definingObjectiveId(objective.getId()).title("O").build());
    String body =
        """
        {"weekStart":"%s","items":[{"text":"ship it","supportingOutcomeId":"%s","chessTier":"KING"}]}
        """
            .formatted(MONDAY, outcome.getId());

    mockMvc
        .perform(
            post("/api/commits")
                .with(as(bob))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("not_found"));
  }

  @Test
  void createWithRealSupportingOutcomeSucceeds() throws Exception {
    // Control: a real leaf id still creates a DRAFT (the new check must not reject good links).
    Member carol = member("carol-good-link");
    UUID soId = seedSupportingOutcome();
    String body =
        """
        {"weekStart":"%s","items":[{"text":"ship it","supportingOutcomeId":"%s","chessTier":"KING"}]}
        """
            .formatted(MONDAY, soId);

    mockMvc
        .perform(
            post("/api/commits")
                .with(as(carol))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.items[0].supportingOutcomeId").value(soId.toString()));
  }

  @Test
  void createWithNullSupportingOutcomeIsAllowed() throws Exception {
    // KTD5: the link is nullable until lock; a null id must NOT trip the existence check.
    Member dave = member("dave-null-link");
    String body =
        """
        {"weekStart":"%s","items":[{"text":"unlinked for now","supportingOutcomeId":null}]}
        """
            .formatted(MONDAY);

    mockMvc
        .perform(
            post("/api/commits")
                .with(as(dave))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.lifecycleState").value("DRAFT"));
  }

  // --- Findings #2/#3/#5 + #13: weekStart must be a Monday; clean rendered detail -------------

  @Test
  void createWithNonMondayWeekStartIsBadRequestWithMondayDetail() throws Exception {
    Member erin = member("erin-tuesday");
    String body =
        """
        {"weekStart":"%s","items":[]}
        """
            .formatted(TUESDAY);

    mockMvc
        .perform(
            post("/api/commits")
                .with(as(erin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("validation_failed"))
        // #13: the field name is prepended exactly once -> "weekStart must be a Monday...".
        .andExpect(
            jsonPath("$.detail").value("weekStart must be a Monday (the start of the ISO week)"));
  }

  @Test
  void createWithFarFutureWeekStartRendersRangeDetailWithoutDoubledFieldName() throws Exception {
    // A far-future *Monday* fails the bounds check; the rendered detail must read
    // "weekStart is outside the allowed range" (NOT "weekStart weekStart is outside...").
    Member fred = member("fred-far");
    String body =
        """
        {"weekStart":"3000-01-06","items":[]}
        """;

    mockMvc
        .perform(
            post("/api/commits")
                .with(as(fred))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("weekStart is outside the allowed range"));
  }

  // --- Finding #12: zero-item submit -> "at least one item" 422 (not the unlinked message) ----

  @Test
  void submitWithZeroItemsReportsTheAtLeastOneItemMessage() throws Exception {
    Member zoe = member("zoe-empty");
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(zoe.getId())
                .weekStart(LocalDate.parse(MONDAY))
                .lifecycleState(LifecycleState.DRAFT)
                .build());

    mockMvc
        .perform(post("/api/commits/{id}/submit", wc.getId()).with(as(zoe)))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("unprocessable"))
        .andExpect(
            jsonPath("$.detail")
                .value("a weekly commit must have at least one item before submit"));
  }
}
