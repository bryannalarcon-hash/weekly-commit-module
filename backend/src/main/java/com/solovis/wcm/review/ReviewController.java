// ReviewController — REST surface for per-commit manager review writes (U14).
// POST /api/commits/{id}/review upserts the ManagerReview as the acting manager. Authorization
// (manager-of-owner row-level check) lives in ReviewService; errors render as RFC-7807
// ProblemDetail.
package com.solovis.wcm.review;

import com.solovis.wcm.review.dto.ReviewDto;
import com.solovis.wcm.review.dto.ReviewRequest;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/commits/{id}")
public class ReviewController {

  private final ReviewService service;

  public ReviewController(ReviewService service) {
    this.service = service;
  }

  @Operation(summary = "Upsert the commit's manager review (403 unless the owner's manager)")
  @PostMapping("/review")
  public ReviewDto review(@PathVariable UUID id, @Valid @RequestBody ReviewRequest request) {
    return service.review(id, request);
  }
}
