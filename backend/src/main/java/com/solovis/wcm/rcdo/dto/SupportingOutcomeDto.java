// SupportingOutcomeDto — wire shape of an RCDO leaf (U12). Returned both as a tree leaf and as a
// flat row by GET /rcdo/supporting-outcomes?q=. Carries the full breadcrumb-able fields the picker
// needs (id, outcomeId, title, ownerId). Mirrored by the TS SupportingOutcomeDto.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.SupportingOutcome;
import java.util.UUID;

public record SupportingOutcomeDto(UUID id, UUID outcomeId, String title, UUID ownerId) {

  public static SupportingOutcomeDto from(SupportingOutcome so) {
    return new SupportingOutcomeDto(so.getId(), so.getOutcomeId(), so.getTitle(), so.getOwnerId());
  }
}
