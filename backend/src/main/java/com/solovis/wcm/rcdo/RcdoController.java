// RcdoController — read-only REST surface for the RCDO strategy tree + picker filter (U12).
// GET /rcdo/tree returns the nested 4-level tree; GET /rcdo/supporting-outcomes?q= returns the
// filtered leaves. The strategy data is confidential: an authenticated caller is required, which
// the
// security phase enforces (401 for anonymous). RTK-Query friendly resource paths.
package com.solovis.wcm.rcdo;

import com.solovis.wcm.rcdo.dto.RallyCryNode;
import com.solovis.wcm.rcdo.dto.SupportingOutcomeDto;
import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rcdo")
public class RcdoController {

  private final RcdoQueryService service;

  public RcdoController(RcdoQueryService service) {
    this.service = service;
  }

  @Operation(summary = "The nested 4-level RCDO tree (requires an authenticated caller)")
  @GetMapping("/tree")
  public List<RallyCryNode> tree() {
    return service.tree();
  }

  @Operation(summary = "Supporting outcomes filtered by a case-insensitive title query")
  @GetMapping("/supporting-outcomes")
  public List<SupportingOutcomeDto> supportingOutcomes(
      @RequestParam(name = "q", required = false) String query) {
    return service.supportingOutcomes(query);
  }
}
