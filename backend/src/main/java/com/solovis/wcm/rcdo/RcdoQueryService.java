// RcdoQueryService — read-side service for the RCDO strategy tree (U12). Assembles the nested
// 4-level tree (RallyCry -> DefiningObjective -> Outcome -> SupportingOutcome) for the picker, and
// a
// case-insensitive title filter over the flat SupportingOutcome leaves. Read-only; no mutation. The
// confidential strategy data is gated behind authentication in the security phase (controller
// level).
package com.solovis.wcm.rcdo;

import com.solovis.wcm.rcdo.dto.DefiningObjectiveNode;
import com.solovis.wcm.rcdo.dto.OutcomeNode;
import com.solovis.wcm.rcdo.dto.RallyCryNode;
import com.solovis.wcm.rcdo.dto.SupportingOutcomeDto;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RcdoQueryService {

  private final RcdoRepository rcdo;

  public RcdoQueryService(RcdoRepository rcdo) {
    this.rcdo = rcdo;
  }

  /** Build the full nested 4-level tree (GET /rcdo/tree). */
  @Transactional(readOnly = true)
  public List<RallyCryNode> tree() {
    return rcdo.findAllRallyCries().stream().map(this::rallyCryNode).toList();
  }

  /**
   * Filter the flat SupportingOutcome leaves by a case-insensitive title substring (GET
   * /rcdo/supporting-outcomes?q=). A blank query returns every leaf.
   */
  @Transactional(readOnly = true)
  public List<SupportingOutcomeDto> supportingOutcomes(String query) {
    String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
    return rcdo.findAllSupportingOutcomes().stream()
        .filter(so -> needle.isEmpty() || so.getTitle().toLowerCase(Locale.ROOT).contains(needle))
        .map(SupportingOutcomeDto::from)
        .toList();
  }

  private RallyCryNode rallyCryNode(RallyCry rally) {
    List<DefiningObjectiveNode> objectives =
        rcdo.findObjectives(rally.getId()).stream().map(this::objectiveNode).toList();
    return RallyCryNode.of(rally, objectives);
  }

  private DefiningObjectiveNode objectiveNode(DefiningObjective objective) {
    List<OutcomeNode> outcomes =
        rcdo.findOutcomes(objective.getId()).stream().map(this::outcomeNode).toList();
    return DefiningObjectiveNode.of(objective, outcomes);
  }

  private OutcomeNode outcomeNode(Outcome outcome) {
    List<SupportingOutcomeDto> leaves =
        rcdo.findSupportingOutcomes(outcome.getId()).stream()
            .map(SupportingOutcomeDto::from)
            .toList();
    return OutcomeNode.of(outcome, leaves);
  }
}
