// CommitItemRequest — one item in a create/update commit request (U11). Carries the editable PLAN
// fields only: text (required), the nullable RCDO link (KTD5), and chessTier. status is NOT
// settable here — the ACTUAL status is mutated solely via the reconciliation status-patch endpoint
// (U13), keeping content edits and status edits on separate paths.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.ChessTier;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CommitItemRequest(
    @NotBlank @Size(max = 1000) String text, UUID supportingOutcomeId, ChessTier chessTier) {}
