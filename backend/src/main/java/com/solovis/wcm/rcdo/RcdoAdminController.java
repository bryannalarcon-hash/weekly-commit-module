// RcdoAdminController — admin REST surface for the RCDO edit-tree (Strategy "Edit tree"). Mounted
// at
// /api/admin/rcdo, it exposes POST/PUT/DELETE at every level (rally-cries, defining-objectives,
// outcomes, supporting-outcomes), delegating all logic + cascade/guard rules to RcdoAdminService.
// Every mutation is gated upstream by MANAGER_SCOPE (SCOPE_reconcile:commits) — the manager-level
// authority (SecurityConfig prod chain / E2eSecurityConfig hermetic chain) — so a non-manager
// caller is rejected with 403 before reaching here; any MANAGER edits the shared strategy tree.
// DELETE returns 204 No Content; create/update return the full response DTO. Read of the tree stays
// on the public-to-authenticated RcdoController (GET /api/rcdo/tree) and is unaffected.
package com.solovis.wcm.rcdo;

import com.solovis.wcm.rcdo.dto.DefiningObjectiveRequest;
import com.solovis.wcm.rcdo.dto.DefiningObjectiveResponse;
import com.solovis.wcm.rcdo.dto.OutcomeRequest;
import com.solovis.wcm.rcdo.dto.OutcomeResponse;
import com.solovis.wcm.rcdo.dto.RallyCryRequest;
import com.solovis.wcm.rcdo.dto.RallyCryResponse;
import com.solovis.wcm.rcdo.dto.SupportingOutcomeRequest;
import com.solovis.wcm.rcdo.dto.SupportingOutcomeResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/rcdo")
public class RcdoAdminController {

  private final RcdoAdminService service;

  public RcdoAdminController(RcdoAdminService service) {
    this.service = service;
  }

  // --- RallyCry --------------------------------------------------------------------------------

  @Operation(summary = "Create a RallyCry (admin)")
  @PostMapping("/rally-cries")
  public RallyCryResponse createRallyCry(@Valid @RequestBody RallyCryRequest req) {
    return service.createRallyCry(req);
  }

  @Operation(summary = "Update a RallyCry's title/description/window/owner (admin)")
  @PutMapping("/rally-cries/{id}")
  public RallyCryResponse updateRallyCry(
      @PathVariable UUID id, @Valid @RequestBody RallyCryRequest req) {
    return service.updateRallyCry(id, req);
  }

  @Operation(summary = "Delete a RallyCry and its entire subtree (admin)")
  @DeleteMapping("/rally-cries/{id}")
  public ResponseEntity<Void> deleteRallyCry(@PathVariable UUID id) {
    service.deleteRallyCry(id);
    return ResponseEntity.noContent().build();
  }

  // --- DefiningObjective -----------------------------------------------------------------------

  @Operation(summary = "Create a DefiningObjective under a RallyCry (admin)")
  @PostMapping("/defining-objectives")
  public DefiningObjectiveResponse createObjective(
      @Valid @RequestBody DefiningObjectiveRequest req) {
    return service.createObjective(req);
  }

  @Operation(summary = "Update a DefiningObjective's title/description/window/owner (admin)")
  @PutMapping("/defining-objectives/{id}")
  public DefiningObjectiveResponse updateObjective(
      @PathVariable UUID id, @Valid @RequestBody DefiningObjectiveRequest req) {
    return service.updateObjective(id, req);
  }

  @Operation(summary = "Delete a DefiningObjective and its subtree (admin)")
  @DeleteMapping("/defining-objectives/{id}")
  public ResponseEntity<Void> deleteObjective(@PathVariable UUID id) {
    service.deleteObjective(id);
    return ResponseEntity.noContent().build();
  }

  // --- Outcome ---------------------------------------------------------------------------------

  @Operation(summary = "Create an Outcome under a DefiningObjective (admin)")
  @PostMapping("/outcomes")
  public OutcomeResponse createOutcome(@Valid @RequestBody OutcomeRequest req) {
    return service.createOutcome(req);
  }

  @Operation(summary = "Update an Outcome's title/description/window/owner (admin)")
  @PutMapping("/outcomes/{id}")
  public OutcomeResponse updateOutcome(
      @PathVariable UUID id, @Valid @RequestBody OutcomeRequest req) {
    return service.updateOutcome(id, req);
  }

  @Operation(summary = "Delete an Outcome and its subtree (admin)")
  @DeleteMapping("/outcomes/{id}")
  public ResponseEntity<Void> deleteOutcome(@PathVariable UUID id) {
    service.deleteOutcome(id);
    return ResponseEntity.noContent().build();
  }

  // --- SupportingOutcome -----------------------------------------------------------------------

  @Operation(summary = "Create a SupportingOutcome under an Outcome (admin)")
  @PostMapping("/supporting-outcomes")
  public SupportingOutcomeResponse createSupportingOutcome(
      @Valid @RequestBody SupportingOutcomeRequest req) {
    return service.createSupportingOutcome(req);
  }

  @Operation(summary = "Update a SupportingOutcome's title/description/window/owner (admin)")
  @PutMapping("/supporting-outcomes/{id}")
  public SupportingOutcomeResponse updateSupportingOutcome(
      @PathVariable UUID id, @Valid @RequestBody SupportingOutcomeRequest req) {
    return service.updateSupportingOutcome(id, req);
  }

  @Operation(summary = "Delete a SupportingOutcome; 409 if a commit item links it (admin)")
  @DeleteMapping("/supporting-outcomes/{id}")
  public ResponseEntity<Void> deleteSupportingOutcome(@PathVariable UUID id) {
    service.deleteSupportingOutcome(id);
    return ResponseEntity.noContent().build();
  }
}
