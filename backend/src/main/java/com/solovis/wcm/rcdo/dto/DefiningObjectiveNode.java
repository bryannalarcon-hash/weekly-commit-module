// DefiningObjectiveNode — second RCDO tree level (U12): a DefiningObjective with its Outcome
// children nested. Part of the GET /rcdo/tree response. Mirrored by the TS DefiningObjectiveNode.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.DefiningObjective;
import java.util.List;
import java.util.UUID;

public record DefiningObjectiveNode(UUID id, String title, List<OutcomeNode> outcomes) {

  public static DefiningObjectiveNode of(DefiningObjective objective, List<OutcomeNode> outcomes) {
    return new DefiningObjectiveNode(objective.getId(), objective.getTitle(), outcomes);
  }
}
