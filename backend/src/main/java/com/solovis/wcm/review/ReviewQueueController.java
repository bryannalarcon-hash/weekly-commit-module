// ReviewQueueController — REST surface for the manager review queue (U21).
// GET /api/review-queue?weekStart=&page=&size= returns the FLAT PageResponse of the acting
// manager's
// reports' submission status for the selected week. Manager-only (gated in SecurityConfig); the
// manager id is the token's, never a param. Row-level filtering + paging live in
// ReviewQueueService.
package com.solovis.wcm.review;

import com.solovis.wcm.common.PageResponse;
import com.solovis.wcm.review.dto.ReviewQueueRow;
import io.swagger.v3.oas.annotations.Operation;
import java.time.LocalDate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/review-queue")
public class ReviewQueueController {

  private final ReviewQueueService service;

  public ReviewQueueController(ReviewQueueService service) {
    this.service = service;
  }

  @Operation(summary = "The acting manager's review queue for a week (Pageable, capped at 2000)")
  @GetMapping
  public PageResponse<ReviewQueueRow> queue(
      @RequestParam(name = "weekStart", required = false)
          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate weekStart,
      @PageableDefault(size = 50) Pageable pageable) {
    return PageResponse.of(service.queue(weekStart, pageable));
  }
}
