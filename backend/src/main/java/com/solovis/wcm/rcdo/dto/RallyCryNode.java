// RallyCryNode — root RCDO tree level (U12): a RallyCry with its DefiningObjective children nested.
// The element type of the GET /rcdo/tree response array (4 levels deep). Mirrored by the TS
// RallyCryNode.
package com.solovis.wcm.rcdo.dto;

import com.solovis.wcm.rcdo.RallyCry;
import java.util.List;
import java.util.UUID;

public record RallyCryNode(UUID id, String title, List<DefiningObjectiveNode> definingObjectives) {

  public static RallyCryNode of(RallyCry rally, List<DefiningObjectiveNode> definingObjectives) {
    return new RallyCryNode(rally.getId(), rally.getTitle(), definingObjectives);
  }
}
