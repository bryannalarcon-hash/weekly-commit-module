// RcdoAdminControllerIT — MockMvc tests for the admin RCDO edit-tree CRUD (/api/admin/rcdo/**),
// full stack against Testcontainers Postgres on the JWT chain. Proves: an admin (SCOPE_admin:rcdo)
// can create/update/delete at every level; a cascade delete removes the whole subtree; deleting a
// SupportingOutcome a commit_item links is blocked with 409; non-admins (employee/manager) get 403;
// an unknown id -> 404; an invalid body -> 400; and owner + date-window round-trip through the API.
package com.solovis.wcm.rcdo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
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
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class RcdoAdminControllerIT extends AbstractWebIT {

  /** The Auth0 permission that gates the admin RCDO edit-tree (mapped to SCOPE_admin:rcdo). */
  private static final String ADMIN_PERMISSION = "admin:rcdo";

  @Autowired private RcdoRepository rcdo;
  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository commitItems;

  /** A bearer with the admin:rcdo permission -> SCOPE_admin:rcdo authority. */
  private RequestPostProcessor admin() {
    return TestJwtConfig.bearer(
        TestJwtConfig.mint(
            "auth0|admin-" + UUID.randomUUID(), "admin@solovis.test", ADMIN_PERMISSION));
  }

  /** A plain employee (no admin permission). */
  private RequestPostProcessor employee() {
    return TestJwtConfig.employee("auth0|emp-" + UUID.randomUUID(), "emp@solovis.test");
  }

  /** A manager (reconcile:commits but NOT admin:rcdo). */
  private RequestPostProcessor manager() {
    return TestJwtConfig.manager("auth0|mgr-" + UUID.randomUUID(), "mgr@solovis.test");
  }

  private Member seedMember() {
    return members.saveAndFlush(
        Member.builder()
            .email("owner-" + UUID.randomUUID() + "@solovis.test")
            .displayName("Owner")
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|owner-" + UUID.randomUUID())
            .build());
  }

  /** Seed a full 4-level path, returning the leaf SupportingOutcome id. */
  private record Path(
      UUID rallyCryId, UUID objectiveId, UUID outcomeId, UUID supportingOutcomeId) {}

  private Path seedPath(String tag) {
    var rally = rcdo.save(RallyCry.builder().title("Rally " + tag).build());
    var objective =
        rcdo.save(
            DefiningObjective.builder().rallyCryId(rally.getId()).title("Obj " + tag).build());
    var outcome =
        rcdo.save(
            Outcome.builder()
                .definingObjectiveId(objective.getId())
                .title("Outcome " + tag)
                .build());
    var so =
        rcdo.save(
            SupportingOutcome.builder().outcomeId(outcome.getId()).title("SO " + tag).build());
    return new Path(rally.getId(), objective.getId(), outcome.getId(), so.getId());
  }

  // --- Create at each level ---------------------------------------------------------------------

  @Test
  void adminCreatesRallyCryWithOwnerAndWindow() throws Exception {
    Member owner = seedMember();
    String body =
        """
        {"title":"New Rally","description":"d","startDate":"2026-01-01","endDate":"2026-12-31",
         "ownerId":"%s"}"""
            .formatted(owner.getId());

    mockMvc
        .perform(
            post("/api/admin/rcdo/rally-cries")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.title").value("New Rally"))
        .andExpect(jsonPath("$.ownerId").value(owner.getId().toString()))
        .andExpect(jsonPath("$.startDate").value("2026-01-01"))
        .andExpect(jsonPath("$.endDate").value("2026-12-31"))
        .andExpect(jsonPath("$.createdBy").exists());
  }

  @Test
  void adminCreatesDefiningObjectiveUnderRally() throws Exception {
    var path = seedPath("do-" + UUID.randomUUID().toString().substring(0, 8));
    String body = "{\"rallyCryId\":\"%s\",\"title\":\"Child DO\"}".formatted(path.rallyCryId());

    mockMvc
        .perform(
            post("/api/admin/rcdo/defining-objectives")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rallyCryId").value(path.rallyCryId().toString()))
        .andExpect(jsonPath("$.title").value("Child DO"));
  }

  @Test
  void adminCreatesOutcomeAndSupportingOutcome() throws Exception {
    var path = seedPath("os-" + UUID.randomUUID().toString().substring(0, 8));

    mockMvc
        .perform(
            post("/api/admin/rcdo/outcomes")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"definingObjectiveId\":\"%s\",\"title\":\"New Outcome\"}"
                        .formatted(path.objectiveId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.definingObjectiveId").value(path.objectiveId().toString()));

    mockMvc
        .perform(
            post("/api/admin/rcdo/supporting-outcomes")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"outcomeId\":\"%s\",\"title\":\"New SO\"}".formatted(path.outcomeId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.outcomeId").value(path.outcomeId().toString()));
  }

  @Test
  void createUnderUnknownParentIsNotFound() throws Exception {
    mockMvc
        .perform(
            post("/api/admin/rcdo/defining-objectives")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"rallyCryId\":\"%s\",\"title\":\"Orphan\"}".formatted(UUID.randomUUID())))
        .andExpect(status().isNotFound());
  }

  // --- Update ----------------------------------------------------------------------------------

  @Test
  void adminUpdatesSupportingOutcomeOwnerAndWindow() throws Exception {
    var path = seedPath("up-" + UUID.randomUUID().toString().substring(0, 8));
    Member owner = seedMember();
    String body =
        """
        {"title":"Renamed SO","description":"upd","startDate":"2026-02-01","endDate":"2026-03-01",
         "ownerId":"%s"}"""
            .formatted(owner.getId());

    mockMvc
        .perform(
            put("/api/admin/rcdo/supporting-outcomes/" + path.supportingOutcomeId())
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Renamed SO"))
        .andExpect(jsonPath("$.ownerId").value(owner.getId().toString()))
        .andExpect(jsonPath("$.startDate").value("2026-02-01"))
        // PUT does not move the node: parent id is unchanged.
        .andExpect(jsonPath("$.outcomeId").value(path.outcomeId().toString()));
  }

  @Test
  void updateUnknownIdIsNotFound() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/rcdo/rally-cries/" + UUID.randomUUID())
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\"}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void blankTitleIsBadRequest() throws Exception {
    mockMvc
        .perform(
            post("/api/admin/rcdo/rally-cries")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"  \"}"))
        .andExpect(status().isBadRequest());
  }

  // --- Delete + cascade ------------------------------------------------------------------------

  @Test
  void deleteRallyCryCascadesEntireSubtree() throws Exception {
    var path = seedPath("del-" + UUID.randomUUID().toString().substring(0, 8));

    mockMvc
        .perform(delete("/api/admin/rcdo/rally-cries/" + path.rallyCryId()).with(admin()))
        .andExpect(status().isNoContent());

    // Every level of the subtree is gone.
    org.junit.jupiter.api.Assertions.assertTrue(rcdo.findRallyCry(path.rallyCryId()).isEmpty());
    org.junit.jupiter.api.Assertions.assertTrue(rcdo.findObjective(path.objectiveId()).isEmpty());
    org.junit.jupiter.api.Assertions.assertTrue(rcdo.findOutcome(path.outcomeId()).isEmpty());
    org.junit.jupiter.api.Assertions.assertTrue(
        rcdo.findSupportingOutcome(path.supportingOutcomeId()).isEmpty());
  }

  @Test
  void deleteSupportingOutcomeLinkedByCommitItemIsConflict() throws Exception {
    var path = seedPath("link-" + UUID.randomUUID().toString().substring(0, 8));
    Member m = seedMember();
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(m.getId())
                .weekStart(LocalDate.parse("2026-06-01"))
                .lifecycleState(LifecycleState.DRAFT)
                .build());
    commitItems.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("links the SO")
            .status(CommitItemStatus.OPEN)
            .supportingOutcomeId(path.supportingOutcomeId())
            .build());

    mockMvc
        .perform(
            delete("/api/admin/rcdo/supporting-outcomes/" + path.supportingOutcomeId())
                .with(admin()))
        .andExpect(status().isConflict());

    // The leaf is still present — the delete was refused, not silently swallowed.
    org.junit.jupiter.api.Assertions.assertTrue(
        rcdo.findSupportingOutcome(path.supportingOutcomeId()).isPresent());
  }

  // --- AuthZ ------------------------------------------------------------------------------------

  @Test
  void employeeCannotCreate() throws Exception {
    mockMvc
        .perform(
            post("/api/admin/rcdo/rally-cries")
                .with(employee())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Nope\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void managerCannotDelete() throws Exception {
    var path = seedPath("mgr-" + UUID.randomUUID().toString().substring(0, 8));
    mockMvc
        .perform(delete("/api/admin/rcdo/rally-cries/" + path.rallyCryId()).with(manager()))
        .andExpect(status().isForbidden());
  }

  @Test
  void anonymousIsUnauthorized() throws Exception {
    mockMvc
        .perform(
            post("/api/admin/rcdo/rally-cries")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\"}"))
        .andExpect(status().isUnauthorized());
  }
}
