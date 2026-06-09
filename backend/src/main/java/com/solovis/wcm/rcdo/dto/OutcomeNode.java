// OutcomeNode — third RCDO tree level (U12): an Outcome with its SupportingOutcome leaves nested.
// Part of the GET /rcdo/tree response. Mirrored by the TS OutcomeNode.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.Outcome;
import java.util.List;
import java.util.UUID;

public record OutcomeNode(UUID id, String title, List<SupportingOutcomeDto> supportingOutcomes) {

  public static OutcomeNode of(Outcome outcome, List<SupportingOutcomeDto> supportingOutcomes) {
    return new OutcomeNode(outcome.getId(), outcome.getTitle(), supportingOutcomes);
  }
}
