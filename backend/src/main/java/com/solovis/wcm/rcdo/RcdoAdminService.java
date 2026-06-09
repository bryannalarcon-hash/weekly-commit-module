// RcdoAdminService — write-side service for the admin RCDO edit-tree CRUD (Strategy "Edit tree").
// Creates/updates/deletes at all four levels (RallyCry -> DefiningObjective -> Outcome ->
// SupportingOutcome). CREATE requires the named parent to exist (else ResourceNotFoundException ->
// 404); UPDATE mutates title/description/window/owner only — it never re-parents a node. DELETE
// cascades DOWN, removing children before the node (so parent-FK rows are never orphaned), and a
// SupportingOutcome that any commit_item links is REFUSED with IllegalCommitStateException -> 409
// (blocking, not nulling, to keep weekly plans referentially intact). AuthZ is enforced upstream by
// the SCOPE_admin:rcdo gate in SecurityConfig; this service assumes the caller is already an admin.
package com.solovis.wcm.rcdo;

import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.common.IllegalCommitStateException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.rcdo.dto.DefiningObjectiveRequest;
import com.solovis.wcm.rcdo.dto.DefiningObjectiveResponse;
import com.solovis.wcm.rcdo.dto.OutcomeRequest;
import com.solovis.wcm.rcdo.dto.OutcomeResponse;
import com.solovis.wcm.rcdo.dto.RallyCryRequest;
import com.solovis.wcm.rcdo.dto.RallyCryResponse;
import com.solovis.wcm.rcdo.dto.SupportingOutcomeRequest;
import com.solovis.wcm.rcdo.dto.SupportingOutcomeResponse;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RcdoAdminService {

  private final RcdoRepository rcdo;
  private final CommitItemRepository commitItems;

  public RcdoAdminService(RcdoRepository rcdo, CommitItemRepository commitItems) {
    this.rcdo = rcdo;
    this.commitItems = commitItems;
  }

  // --- RallyCry (root) -------------------------------------------------------------------------

  @Transactional
  public RallyCryResponse createRallyCry(RallyCryRequest req) {
    RallyCry saved =
        rcdo.save(
            RallyCry.builder()
                .title(req.title())
                .description(req.description())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .ownerId(req.ownerId())
                .build());
    return RallyCryResponse.from(saved);
  }

  @Transactional
  public RallyCryResponse updateRallyCry(UUID id, RallyCryRequest req) {
    RallyCry rally = rcdo.findRallyCry(id).orElseThrow(() -> notFound("rally cry", id));
    rally.setTitle(req.title());
    rally.setDescription(req.description());
    rally.setStartDate(req.startDate());
    rally.setEndDate(req.endDate());
    rally.setOwnerId(req.ownerId());
    return RallyCryResponse.from(rcdo.save(rally));
  }

  @Transactional
  public void deleteRallyCry(UUID id) {
    RallyCry rally = rcdo.findRallyCry(id).orElseThrow(() -> notFound("rally cry", id));
    // Cascade DOWN: each child objective (and its subtree) goes first, then the rally itself.
    for (DefiningObjective objective : rcdo.findObjectives(id)) {
      deleteObjectiveSubtree(objective);
    }
    rcdo.delete(rally);
  }

  // --- DefiningObjective (level 2) -------------------------------------------------------------

  @Transactional
  public DefiningObjectiveResponse createObjective(DefiningObjectiveRequest req) {
    rcdo.findRallyCry(req.rallyCryId()).orElseThrow(() -> notFound("rally cry", req.rallyCryId()));
    DefiningObjective saved =
        rcdo.save(
            DefiningObjective.builder()
                .rallyCryId(req.rallyCryId())
                .title(req.title())
                .description(req.description())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .ownerId(req.ownerId())
                .build());
    return DefiningObjectiveResponse.from(saved);
  }

  @Transactional
  public DefiningObjectiveResponse updateObjective(UUID id, DefiningObjectiveRequest req) {
    DefiningObjective objective =
        rcdo.findObjective(id).orElseThrow(() -> notFound("defining objective", id));
    objective.setTitle(req.title());
    objective.setDescription(req.description());
    objective.setStartDate(req.startDate());
    objective.setEndDate(req.endDate());
    objective.setOwnerId(req.ownerId());
    return DefiningObjectiveResponse.from(rcdo.save(objective));
  }

  @Transactional
  public void deleteObjective(UUID id) {
    DefiningObjective objective =
        rcdo.findObjective(id).orElseThrow(() -> notFound("defining objective", id));
    deleteObjectiveSubtree(objective);
  }

  // --- Outcome (level 3) -----------------------------------------------------------------------

  @Transactional
  public OutcomeResponse createOutcome(OutcomeRequest req) {
    rcdo.findObjective(req.definingObjectiveId())
        .orElseThrow(() -> notFound("defining objective", req.definingObjectiveId()));
    Outcome saved =
        rcdo.save(
            Outcome.builder()
                .definingObjectiveId(req.definingObjectiveId())
                .title(req.title())
                .description(req.description())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .ownerId(req.ownerId())
                .build());
    return OutcomeResponse.from(saved);
  }

  @Transactional
  public OutcomeResponse updateOutcome(UUID id, OutcomeRequest req) {
    Outcome outcome = rcdo.findOutcome(id).orElseThrow(() -> notFound("outcome", id));
    outcome.setTitle(req.title());
    outcome.setDescription(req.description());
    outcome.setStartDate(req.startDate());
    outcome.setEndDate(req.endDate());
    outcome.setOwnerId(req.ownerId());
    return OutcomeResponse.from(rcdo.save(outcome));
  }

  @Transactional
  public void deleteOutcome(UUID id) {
    Outcome outcome = rcdo.findOutcome(id).orElseThrow(() -> notFound("outcome", id));
    deleteOutcomeSubtree(outcome);
  }

  // --- SupportingOutcome (leaf) ----------------------------------------------------------------

  @Transactional
  public SupportingOutcomeResponse createSupportingOutcome(SupportingOutcomeRequest req) {
    rcdo.findOutcome(req.outcomeId()).orElseThrow(() -> notFound("outcome", req.outcomeId()));
    SupportingOutcome saved =
        rcdo.save(
            SupportingOutcome.builder()
                .outcomeId(req.outcomeId())
                .title(req.title())
                .description(req.description())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .ownerId(req.ownerId())
                .build());
    return SupportingOutcomeResponse.from(saved);
  }

  @Transactional
  public SupportingOutcomeResponse updateSupportingOutcome(UUID id, SupportingOutcomeRequest req) {
    SupportingOutcome so =
        rcdo.findSupportingOutcome(id).orElseThrow(() -> notFound("supporting outcome", id));
    so.setTitle(req.title());
    so.setDescription(req.description());
    so.setStartDate(req.startDate());
    so.setEndDate(req.endDate());
    so.setOwnerId(req.ownerId());
    return SupportingOutcomeResponse.from(rcdo.save(so));
  }

  @Transactional
  public void deleteSupportingOutcome(UUID id) {
    SupportingOutcome so =
        rcdo.findSupportingOutcome(id).orElseThrow(() -> notFound("supporting outcome", id));
    deleteLeaf(so);
  }

  // --- Cascade helpers (always delete children before the node) --------------------------------

  private void deleteObjectiveSubtree(DefiningObjective objective) {
    for (Outcome outcome : rcdo.findOutcomes(objective.getId())) {
      deleteOutcomeSubtree(outcome);
    }
    rcdo.delete(objective);
  }

  private void deleteOutcomeSubtree(Outcome outcome) {
    for (SupportingOutcome so : rcdo.findSupportingOutcomes(outcome.getId())) {
      deleteLeaf(so);
    }
    rcdo.delete(outcome);
  }

  /**
   * Delete a leaf, but BLOCK with 409 if any commit_item links it: nulling the link would silently
   * break weekly plans, so an admin must first detach/reassign those items.
   */
  private void deleteLeaf(SupportingOutcome so) {
    if (commitItems.existsBySupportingOutcomeId(so.getId())) {
      throw new IllegalCommitStateException(
          "Supporting outcome is referenced by one or more commit items and cannot be deleted");
    }
    rcdo.delete(so);
  }

  private static ResourceNotFoundException notFound(String what, UUID id) {
    return new ResourceNotFoundException("No %s with id %s".formatted(what, id));
  }
}
