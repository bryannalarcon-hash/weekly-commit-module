// ReconciliationControllerIT — MockMvc tests for the reconcile half of the lifecycle (U13), full
// stack against Testcontainers Postgres, AUTHENTICATED via locally minted RS256 tokens (U15). The
// IC (OWNER) drives reconciliation end to end: they /reconcile (open), patch item statuses,
// /reconciled (close), read their own planned-vs-actual diff, and carry forward — all owner-only.
// Proves: a status patch in RECONCILING -> 200 and persists; a status patch outside RECONCILING ->
// 409; the GET /reconciliation diff flags an INCOMPLETE planned item and an ADDED_AFTER_LOCK item;
// the OWNER-driven RECONCILING -> RECONCILED touches NO ManagerReview (the manager reviews
// separately); a MANAGER attempting /reconcile or /reconciled on a report gets 403; the
// GET /reconciliation diff is readable by the OWNER and the owner's MANAGER but 403 for an
// unrelated manager or a peer non-manager (Finding #4/#11); and carry-forward into an already-taken
// next week is a clean 409, not a 500.
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

  /** A MANAGER (canReview()) — reads the report's diff and reviews it, but does NOT reconcile. */
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

  /**
   * Manager token carrying reconcile:commits — reads the diff; cannot drive the IC-owned reconcile.
   */
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

  /** Move the commit to RECONCILING as the OWNER (the IC drives reconciliation). */
  private void startReconciling(UUID commitId, Member owner) throws Exception {
    mockMvc
        .perform(post("/api/commits/{id}/reconcile", commitId).with(asOwner(owner)))
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

    startReconciling(id, owner);

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

    // Owner moves to RECONCILING and marks the planned item INCOMPLETE.
    startReconciling(id, owner);
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
  void reconciliationDiffReadableByOwnerAndOwnersManager() throws Exception {
    // Finding #4/#11: the owner's direct MANAGER reviews the reconciled week and already reads the
    // raw commit + rollup, so they must also be able to GET the planned-vs-actual diff for their
    // own report (to inform that review). The OWNER reads it too. Both -> 200 with the diff rows
    // present.
    Member manager = managerMember("mgr");
    Member owner = employee("read-owner", manager.getId());
    UUID id = createAndLock(owner);
    UUID plannedId = plannedItemId(id);

    // Owner reads their own diff -> 200 with the planned row present.
    mockMvc
        .perform(get("/api/commits/{id}/reconciliation", id).with(asOwner(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[?(@.commitItemId=='%s')]".formatted(plannedId)).exists());

    // The owner's manager reads the same report's diff -> 200 with the planned row present.
    mockMvc
        .perform(get("/api/commits/{id}/reconciliation", id).with(asManager(manager)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[?(@.commitItemId=='%s')]".formatted(plannedId)).exists());
  }

  @Test
  void reconciliationDiffForbiddenForUnrelatedManager() throws Exception {
    // Finding #4/#11: a genuine manager who does NOT manage the owner clears the URL filter
    // (any authenticated member may reach the GET) but must fail the service row-level check ->
    // 403.
    Member manager = managerMember("mgr");
    Member other = managerMember("other-mgr"); // has scope, but does NOT manage the owner
    Member owner = employee("read-foreign-owner", manager.getId());
    UUID id = createAndLock(owner);

    mockMvc
        .perform(get("/api/commits/{id}/reconciliation", id).with(asManager(other)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void reconciliationDiffForbiddenForPeerNonManager() throws Exception {
    // Finding #4/#11: a peer employee (no manager scope, not the owner, not the owner's manager)
    // must not read another member's diff -> 403.
    Member manager = managerMember("mgr");
    Member owner = employee("read-peer-owner", manager.getId());
    Member peer = employee("read-peer", manager.getId()); // a sibling report, not a manager
    UUID id = createAndLock(owner);

    mockMvc
        .perform(get("/api/commits/{id}/reconciliation", id).with(asOwner(peer)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void ownerDrivesFullReconcileFlowAndItCreatesNoReview() throws Exception {
    // The IC owns reconciliation end to end: open it, record an actual, then close it — all as the
    // owner. The RECONCILING -> RECONCILED transition touches NO ManagerReview (the manager reviews
    // separately), so no review row exists and the commit's reviewer/reviewedAt stay unset.
    Member manager = managerMember("mgr");
    Member owner = employee("reconciled-owner", manager.getId());
    UUID id = createAndLock(owner);
    UUID itemId = plannedItemId(id);

    startReconciling(id, owner);
    mockMvc
        .perform(
            patch("/api/commits/{id}/items/{itemId}/status", id, itemId)
                .with(asOwner(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"COMPLETE\"}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/api/commits/{id}/reconciled", id).with(asOwner(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lifecycleState").value("RECONCILED"));

    // No ManagerReview is created by reconciliation, and the commit is not stamped as reviewed.
    org.assertj.core.api.Assertions.assertThat(reviews.findByWeeklyCommitId(id)).isEmpty();
    WeeklyCommit reconciled = commits.findById(id).orElseThrow();
    org.assertj.core.api.Assertions.assertThat(reconciled.getReviewedAt()).isNull();
    org.assertj.core.api.Assertions.assertThat(reconciled.getReviewerId()).isNull();
  }

  @Test
  void ownersManagerCannotDriveReconcileTransitions() throws Exception {
    // Reconciliation is OWNER-driven: even the owner's own manager (who reviews the week
    // separately)
    // is NOT the actor for /reconcile or /reconciled — the service's owner-only check (loadOwned)
    // rejects them with 403.
    Member manager = managerMember("mgr");
    Member owner = employee("mgr-blocked-owner", manager.getId());
    UUID id = createAndLock(owner);

    mockMvc
        .perform(post("/api/commits/{id}/reconcile", id).with(asManager(manager)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));

    // Move it to RECONCILING as the owner, then the manager still cannot close it.
    startReconciling(id, owner);
    mockMvc
        .perform(post("/api/commits/{id}/reconciled", id).with(asManager(manager)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void unrelatedMemberCannotDriveReconcile() throws Exception {
    // A non-owner who is neither the owner nor authorized clears the (authenticated-only) URL gate
    // but fails the service's owner-only row check -> 403.
    Member manager = managerMember("mgr");
    Member other = managerMember("other-mgr"); // not the owner, does not own this commit
    Member owner = employee("foreign-owner", manager.getId());
    UUID id = createAndLock(owner);

    mockMvc
        .perform(post("/api/commits/{id}/reconcile", id).with(asManager(other)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));
  }

  @Test
  void reconciliationOnDraftReturnsEmptyNotApplicableViewWithNoAddedAfterLockFlags()
      throws Exception {
    // A DRAFT was never LOCKED, so there is NO frozen snapshot. The previous behavior joined the
    // (empty) snapshot to the live items and flagged every live DRAFT item ADDED_AFTER_LOCK — a
    // nonsensical diff. The guard must instead serve an empty/not-applicable view (the live items
    // are the plan-in-progress, not post-lock additions), still echoing the DRAFT lifecycle state
    // so the FE's not-yet-locked path can redirect.
    Member owner = employee("draft-recon-owner", managerMember("mgr").getId());
    String body =
        """
        {"weekStart":"2026-06-08","items":[{"text":"in-progress draft task","supportingOutcomeId":"%s","chessTier":"KING"}]}
        """
            .formatted(seedSupportingOutcome());
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
        .perform(get("/api/commits/{id}/reconciliation", id).with(asOwner(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lifecycleState").value("DRAFT"))
        // No diff rows at all — pre-lock items are NEVER flagged ADDED_AFTER_LOCK.
        .andExpect(jsonPath("$.rows.length()").value(0));
  }

  @Test
  void carryForwardCopiesIncompleteIntoNextWeekDraft() throws Exception {
    Member manager = managerMember("mgr");
    Member owner = employee("carry-owner", manager.getId());
    UUID id = createAndLock(owner);
    UUID plannedId = plannedItemId(id);

    startReconciling(id, owner);
    mockMvc
        .perform(
            patch("/api/commits/{id}/items/{itemId}/status", id, plannedId)
                .with(asOwner(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INCOMPLETE\"}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/api/commits/{id}/reconciled", id).with(asOwner(owner)))
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
