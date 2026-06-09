// CommitControllerIT — MockMvc tests for the weekly-commit CRUD + submit (U11), full stack against
// Testcontainers Postgres, now AUTHENTICATED via locally minted RS256 bearer tokens (U15). Proves:
// create->read round-trip; a spoofed body memberId is IGNORED (the commit is owned by the acting
// JWT-subject member, KTD6); reading another member's commit -> 403; submit with an unlinked item
// -> 422; submit valid -> LOCKED; a content edit on a LOCKED commit -> 409; and the NFR perf
// assertion that a plan-retrieval read returns in <200ms. Each request carries the owner's token.
package com.solovis.wcm.commit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import com.solovis.wcm.rcdo.Outcome;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class CommitControllerIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private RcdoRepository rcdo;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;

  private Member member(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  /** A bearer token whose subject is the member's auth0Subject (resolves back to that member). */
  private RequestPostProcessor as(Member m) {
    return TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
  }

  /** Seed a full RCDO path and return a linkable SupportingOutcome id (NOT NULL FK chain). */
  private UUID seedSupportingOutcome() {
    var rally =
        rcdo.save(com.solovis.wcm.rcdo.RallyCry.builder().title("RC " + UUID.randomUUID()).build());
    var objective =
        rcdo.save(
            com.solovis.wcm.rcdo.DefiningObjective.builder()
                .rallyCryId(rally.getId())
                .title("DO")
                .build());
    Outcome outcome =
        rcdo.save(Outcome.builder().definingObjectiveId(objective.getId()).title("O").build());
    SupportingOutcome so =
        rcdo.save(SupportingOutcome.builder().outcomeId(outcome.getId()).title("SO").build());
    return so.getId();
  }

  @Test
  void createThenReadRoundTrips() throws Exception {
    Member alice = member("alice");
    UUID soId = seedSupportingOutcome();
    String body =
        """
        {"weekStart":"2026-06-08","items":[{"text":"ship it","supportingOutcomeId":"%s","chessTier":"KING"}]}
        """
            .formatted(soId);

    MvcResult created =
        mockMvc
            .perform(
                post("/api/commits")
                    .with(as(alice))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.memberId").value(alice.getId().toString()))
            .andExpect(jsonPath("$.lifecycleState").value("DRAFT"))
            .andExpect(jsonPath("$.items[0].text").value("ship it"))
            .andReturn();

    String id =
        objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(get("/api/commits/{id}", id).with(as(alice)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(id))
        .andExpect(jsonPath("$.items[0].supportingOutcomeId").value(soId.toString()));
  }

  @Test
  void spoofedBodyMemberIdIsIgnoredCommitBelongsToActingMember() throws Exception {
    Member alice = member("alice2");
    Member victim = member("victim");
    String body =
        """
        {"weekStart":"2026-06-08","items":[],"memberId":"%s"}
        """
            .formatted(victim.getId());

    mockMvc
        .perform(
            post("/api/commits")
                .with(as(alice))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        // Owner is the acting member (alice), NOT the spoofed victim id in the body (KTD6).
        .andExpect(jsonPath("$.memberId").value(alice.getId().toString()));
  }

  @Test
  void readingAnotherMembersCommitIsForbidden() throws Exception {
    Member owner = member("owner");
    Member intruder = member("intruder");
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(owner.getId())
                .weekStart(java.time.LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.DRAFT)
                .build());

    mockMvc
        .perform(get("/api/commits/{id}", wc.getId()).with(as(intruder)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void submitWithUnlinkedItemIsUnprocessable() throws Exception {
    Member bob = member("bob");
    WeeklyCommit wc = draftWithUnlinkedItem(bob);

    mockMvc
        .perform(post("/api/commits/{id}/submit", wc.getId()).with(as(bob)))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("unprocessable"));
  }

  @Test
  void submitWithZeroItemsIsUnprocessable() throws Exception {
    // Deferred fix: a commit with NO items cannot LOCK (the old vacuous allItemsLinked() let it).
    Member zoe = member("zoe");
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(zoe.getId())
                .weekStart(java.time.LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.DRAFT)
                .build());

    mockMvc
        .perform(post("/api/commits/{id}/submit", wc.getId()).with(as(zoe)))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("unprocessable"));

    assertThat(commits.findById(wc.getId()).orElseThrow().getLifecycleState())
        .isEqualTo(LifecycleState.DRAFT);
  }

  @Test
  void createWithAbsurdFarFutureWeekStartIsRejected() throws Exception {
    // Deferred fix: weekStart is bounded — an absurd far-future date is a 400 validation error.
    Member yan = member("yan");
    String body =
        """
        {"weekStart":"3000-01-06","items":[]}
        """;
    mockMvc
        .perform(
            post("/api/commits")
                .with(as(yan))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createWithAbsurdFarPastWeekStartIsRejected() throws Exception {
    Member xan = member("xan");
    String body =
        """
        {"weekStart":"1990-01-01","items":[]}
        """;
    mockMvc
        .perform(
            post("/api/commits")
                .with(as(xan))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void submitValidLocksTheCommit() throws Exception {
    Member carol = member("carol");
    WeeklyCommit wc = draftWithLinkedItem(carol);

    mockMvc
        .perform(post("/api/commits/{id}/submit", wc.getId()).with(as(carol)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lifecycleState").value("LOCKED"));

    assertThat(commits.findById(wc.getId()).orElseThrow().getLifecycleState())
        .isEqualTo(LifecycleState.LOCKED);
  }

  @Test
  void contentEditOnLockedCommitIsConflict() throws Exception {
    Member dave = member("dave");
    WeeklyCommit wc = draftWithLinkedItem(dave);
    // Lock it first.
    mockMvc
        .perform(post("/api/commits/{id}/submit", wc.getId()).with(as(dave)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            put("/api/commits/{id}", wc.getId())
                .with(as(dave))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"text\":\"new content\"}]}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_transition"));
  }

  @Test
  void planRetrievalReadReturnsUnder200ms() throws Exception {
    Member erin = member("erin");
    WeeklyCommit wc = draftWithLinkedItem(erin);

    // Warm the JIT/context once, then measure the steady-state read latency.
    mockMvc.perform(get("/api/commits/{id}", wc.getId()).with(as(erin))).andExpect(status().isOk());

    long start = System.nanoTime();
    mockMvc.perform(get("/api/commits/{id}", wc.getId()).with(as(erin))).andExpect(status().isOk());
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertThat(elapsedMs).as("plan-retrieval read latency").isLessThan(200L);
  }

  // --- fixtures --------------------------------------------------------------------------------

  private WeeklyCommit draftWithLinkedItem(Member owner) {
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(owner.getId())
                .weekStart(java.time.LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.DRAFT)
                .build());
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("linked task")
            .status(CommitItemStatus.OPEN)
            .supportingOutcomeId(seedSupportingOutcome())
            .chessTier(ChessTier.KING)
            .build());
    return wc;
  }

  private WeeklyCommit draftWithUnlinkedItem(Member owner) {
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(owner.getId())
                .weekStart(java.time.LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.DRAFT)
                .build());
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("unlinked task")
            .status(CommitItemStatus.OPEN)
            .supportingOutcomeId(null)
            .build());
    return wc;
  }
}
