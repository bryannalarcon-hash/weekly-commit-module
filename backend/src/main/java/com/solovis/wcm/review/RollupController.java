// RollupController — REST surface for the manager team roll-up (U14). GET /api/rollup returns a
// paged view of the ACTING manager's reports + metrics; the manager id is implied by the token
// (CurrentMemberProvider), never a client param, so the page is row-level filtered to the caller.
// page/size are explicit @RequestParams with @Min/@Max bounds (page >= 0, 1 <= size <= 2000) and
// the class is @Validated, so out-of-range pagination is rejected as a 400 (ConstraintViolation ->
// validation_failed via ApiExceptionHandler) instead of being silently coerced; the page size cap
// is also enforced by RollupQueryService. The response is the FLAT PageResponse envelope ({content,
// totalElements, totalPages, number, size}) the FE's TS Page<T> contract + RTK Query read directly
// — NOT Spring's nested PagedModel (whose page metadata sits under "page", never read here).
package com.solovis.wcm.review;

import com.solovis.wcm.common.PageResponse;
import com.solovis.wcm.review.dto.RollupRow;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/rollup")
public class RollupController {

  private final RollupQueryService service;

  public RollupController(RollupQueryService service) {
    this.service = service;
  }

  @Operation(summary = "Team roll-up for the acting manager (page >= 0, 1 <= size <= 2000)")
  @GetMapping
  public PageResponse<RollupRow> rollup(
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "50") @Min(1) @Max(2000) int size) {
    Pageable pageable = PageRequest.of(page, size);
    return PageResponse.of(service.rollup(pageable));
  }

  @Operation(
      summary = "Resolve a report's latest reviewable commit id (dashboard drill-through → review)")
  @GetMapping("/reports/{memberId}/latest-commit")
  public Map<String, String> latestReviewableCommit(@PathVariable UUID memberId) {
    return Map.of("commitId", service.latestReviewableCommitId(memberId).toString());
  }
}
