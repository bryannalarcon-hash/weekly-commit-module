// RollupController — REST surface for the manager team roll-up (U14). GET /api/rollup returns a
// Pageable page of the ACTING manager's reports + metrics; the manager id is implied by the token
// (CurrentMemberProvider), never a client param, so the page is row-level filtered to the caller.
// Spring binds ?page=&size=&sort= into Pageable; RollupQueryService caps size at 2000.
package com.solovis.wcm.review;

import com.solovis.wcm.review.dto.RollupRow;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rollup")
public class RollupController {

  private final RollupQueryService service;

  public RollupController(RollupQueryService service) {
    this.service = service;
  }

  @Operation(summary = "Team roll-up for the acting manager (Pageable, size capped at 2000)")
  @GetMapping
  public Page<RollupRow> rollup(@PageableDefault(size = 50) Pageable pageable) {
    return service.rollup(pageable);
  }
}
