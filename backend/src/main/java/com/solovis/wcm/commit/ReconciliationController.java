// ReconciliationController — REST surface for the reconcile half of the lifecycle (U13).
// POST /reconcile (LOCKED->RECONCILING), PATCH item status (RECONCILING-only), POST /reconciled
// (RECONCILING->RECONCILED), GET /reconciliation (planned-vs-actual diff), POST /carry-forward.
// Ownership + state guards live in ReconciliationService; errors render as RFC-7807 ProblemDetail.
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.CommitDto;
import com.solovis.wcm.commit.dto.ItemStatusPatch;
import com.solovis.wcm.commit.dto.ReconciliationView;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/commits/{id}")
public class ReconciliationController {

  private final ReconciliationService service;

  public ReconciliationController(ReconciliationService service) {
    this.service = service;
  }

  @Operation(summary = "Start reconciliation (LOCKED -> RECONCILING)")
  @PostMapping("/reconcile")
  public CommitDto reconcile(@PathVariable UUID id) {
    return service.startReconciling(id);
  }

  @Operation(summary = "Patch an item's ACTUAL status (allowed only while RECONCILING; else 409)")
  @PatchMapping("/items/{itemId}/status")
  public CommitDto patchStatus(
      @PathVariable UUID id, @PathVariable UUID itemId, @Valid @RequestBody ItemStatusPatch patch) {
    return service.patchItemStatus(id, itemId, patch);
  }

  @Operation(summary = "Mark reviewed (RECONCILING -> RECONCILED); forces ManagerReview REVIEWED")
  @PostMapping("/reconciled")
  public CommitDto reconciled(@PathVariable UUID id) {
    return service.markReconciled(id);
  }

  @Operation(summary = "Planned (snapshot) vs actual (live status) diff with per-row flags")
  @GetMapping("/reconciliation")
  public ReconciliationView reconciliation(@PathVariable UUID id) {
    return service.reconciliation(id);
  }

  @Operation(summary = "Carry INCOMPLETE items into a fresh next-week DRAFT")
  @PostMapping("/carry-forward")
  public CommitDto carryForward(@PathVariable UUID id) {
    return service.carryForward(id);
  }
}
