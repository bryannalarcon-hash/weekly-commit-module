// ReconciliationControllerIT — MockMvc tests for the reconcile half of the lifecycle (U13), full
// stack against Testcontainers Postgres, AUTHENTICATED via locally minted RS256 tokens (U15). The
// ACTOR MODEL is split (KTD6): a genuine MANAGER (carries reconcile:commits and manages the owner)
// drives the scope-gated /reconcile and /reconciled transitions, while the EMPLOYEE OWNER (no
// scope)
// drafts/locks, records actual statuses, reads their own planned-vs-actual diff, and carries
// forward.
// Proves: a status patch in RECONCILING -> 200 and persists; a status patch outside RECONCILING ->
// 409; the GET /reconciliation diff flags an INCOMPLETE planned item and an ADDED_AFTER_LOCK item;
// the manager-driven RECONCILING -> RECONCILED forces the ManagerReview REVIEWED; an employee owner
// cannot self-drive /reconcile or /reconciled (403); a non-managing manager is also 403; and
// carry-forward into an already-taken next week is a clean 409, not a 500.
package com.solovis.wcm.commit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class ReconciliationControllerIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private RcdoRepository rcdo;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;
  @Autowired private com.solovis.wcm.review.ManagerReviewRepository reviews;

  /** An EMPLOYEE owner managed by {@code managerId} (or top-level when null). */
  private Member employee(String slug, UUID managerId) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .managerId(managerId)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  /** A MANAGER (canReview()) — the actor authorized to drive the reconcile transitions. */
  private Member managerMember(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.MANAGER)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  /**
   * Employee token (NO manager scope) — drafts/locks/patches/diffs/carries-forward as the owner.
   */
  private RequestPostProcessor asOwner(Member m) {
    return TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
  }

  /** Manager token carrying reconcile:commits — drives the scope-gated reconcile transitions. */
  private RequestPostProcessor asManager(Member m) {
    return TestJwtConfig.manager(m.getAuth0Subject(), m.getEmail());
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

  /**
   * Create a 1-item draft via the API as the owner and submit it -> LOCKED, writing the snapshot.
   */
  private UUID createAndLock(Member owner) throws Exception {
    return createAndLock(owner, "2026-06-08");
  }

  private UUID createAndLock(Member owner, String weekStart) throws Exception {
    String body =
        """
        {"weekStart":"%s","items":[{"text":"planned task","supportingOutcomeId":"%s","chessTier":"KING"}]}
        """
            .formatted(weekStart, seedSupportingOutcome());
    var created =
        mockMvc
            .perform(
                post("/api/commits")
                    .with(asOwner(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    UUID id =
        UUID.fromString(
            objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(post("/api/commits/{id}/submit", id).with(asOwner(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lifecycleState").value("LOCKED"));
    return id;
  }

  private UUID plannedItemId(UUID commitId) {
    return items.findByWeeklyCommitId(commitId).get(0).getId();
  }

  /** Move the commit to RECONCILING as the owner's manager (the only actor allowed to). */
  private void startReconciling(UUID commitId, Member manager) throws Exception {
    mockMvc
        .perform(post("/api/commits/{id}/reconcile", commitId).with(asManager(manager)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lifecycleState").value("RECONCILING"));
  }

  @Test
  void statusEditOutsideReconcilingIsConflict() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("locked-owner", manager.getId());
    UUID id = createAndLock(owner);
    UUID itemId = plannedItemId(id);

    // Commit is LOCKED (not RECONCILING) — a status patch must be rejected.
    mockMvc
        .perform(
            patch("/api/commits/{id}/items/{itemId}/status", id, itemId)
                .with(asOwner(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"COMPLETE\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_transition"));
  }

  @Test
  void statusEditInReconcilingSucceeds() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("recon-owner", manager.getId());
    UUID id = createAndLock(owner);
    UUID itemId = plannedItemId(id);

    startReconciling(id, manager);

    mockMvc
        .perform(
            patch("/api/commits/{id}/items/{itemId}/status", id, itemId)
                .with(asOwner(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INCOMPLETE\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[?(@.id=='%s')].status".formatted(itemId)).value("INCOMPLETE"));
  }

  @Test
  void reconciliationDiffFlagsIncompleteAndAddedAfterLock() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("diff-owner", manager.getId());
    UUID id = createAndLock(owner);
    UUID plannedId = plannedItemId(id);

    // Add a NEW item directly after lock (no frozen plan line for it).
    UUID addedId =
        items
            .saveAndFlush(
                CommitItem.builder()
                    .weeklyCommitId(id)
                    .text("snuck in after lock")
                    .status(CommitItemStatus.OPEN)
                    .supportingOutcomeId(seedSupportingOutcome())
                    .build())
            .getId();

    // Manager moves to RECONCILING; owner marks the planned item INCOMPLETE.
    startReconciling(id, manager);
    mockMvc
        .perform(
            patch("/api/commits/{id}/items/{itemId}/status", id, plannedId)
                .with(asOwner(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INCOMPLETE\"}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/api/commits/{id}/reconciliation", id).with(asOwner(owner)))
        .andExpect(status().isOk())
        // The planned item is flagged INCOMPLETE.
        .andExpect(
            jsonPath("$.rows[?(@.commitItemId=='%s')].flag".formatted(plannedId))
                .value("INCOMPLETE"))
        // The item added after lock is flagged ADDED_AFTER_LOCK.
        .andExpect(
            jsonPath("$.rows[?(@.commitItemId=='%s')].flag".formatted(addedId))
                .value("ADDED_AFTER_LOCK"));
  }

  @Test
  void reconciledTransitionForcesReviewReviewed() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("reconciled-owner", manager.getId());
    UUID id = createAndLock(owner);

    startReconciling(id, manager);
    mockMvc
        .perform(post("/api/commits/{id}/reconciled", id).with(asManager(manager)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lifecycleState").value("RECONCILED"));

    var review = reviews.findByWeeklyCommitId(id).orElseThrow();
    org.assertj.core.api.Assertions.assertThat(review.isReviewed()).isTrue();
    // The acting manager is recorded as the reviewer (no self-review by the owner).
    org.assertj.core.api.Assertions.assertThat(review.getReviewerId()).isEqualTo(manager.getId());
  }

  @Test
  void ownerCannotSelfDriveReconcileTransitions() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("self-owner", manager.getId());
    UUID id = createAndLock(owner);

    // The owner (employee, no manager scope) is rejected at the security filter -> 403.
    mockMvc
        .perform(post("/api/commits/{id}/reconcile", id).with(asOwner(owner)))
        .andExpect(status().isForbidden());
  }

  @Test
  void nonManagingManagerCannotDriveReconcile() throws Exception {
    Member manager = managerMember("mgr");
    Member other = managerMember("other-mgr"); // has scope, but does NOT manage the owner
    Member owner = employee("foreign-owner", manager.getId());
    UUID id = createAndLock(owner);

    // A genuine manager who does not manage the owner clears the scope gate but fails the row
    // check.
    mockMvc
        .perform(post("/api/commits/{id}/reconcile", id).with(asManager(other)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void carryForwardCopiesIncompleteIntoNextWeekDraft() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("carry-owner", manager.getId());
    UUID id = createAndLock(owner);
    UUID plannedId = plannedItemId(id);

    startReconciling(id, manager);
    mockMvc
        .perform(
            patch("/api/commits/{id}/items/{itemId}/status", id, plannedId)
                .with(asOwner(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INCOMPLETE\"}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/api/commits/{id}/reconciled", id).with(asManager(manager)))
        .andExpect(status().isOk());

    var carried =
        mockMvc
            .perform(post("/api/commits/{id}/carry-forward", id).with(asOwner(owner)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.lifecycleState").value("DRAFT"))
            .andExpect(jsonPath("$.weekStart").value(LocalDate.parse("2026-06-15").toString()))
            .andExpect(jsonPath("$.items.length()").value(1))
            .andReturn();
    org.assertj.core.api.Assertions.assertThat(carried.getResponse().getStatus()).isEqualTo(200);
  }

  @Test
  void carryForwardIntoExistingNextWeekIsConflict() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("collide-owner", manager.getId());
    UUID id = createAndLock(owner, "2026-06-08");

    // The owner already has a DRAFT for the NEXT week — carry-forward must not collide-500.
    mockMvc
        .perform(
            post("/api/commits")
                .with(asOwner(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"weekStart\":\"2026-06-15\",\"items\":[]}"))
        .andExpect(status().isCreated());

    // Use the LOCKED escape hatch to carry forward; the next week (2026-06-15) is already taken.
    mockMvc
        .perform(post("/api/commits/{id}/carry-forward", id).with(asOwner(owner)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("illegal_transition"));
  }
}
