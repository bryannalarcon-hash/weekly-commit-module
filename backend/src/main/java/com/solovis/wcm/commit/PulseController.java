// PulseController — REST surface for the weekly Pulse (U19 thin Pulse), RTK-Query friendly.
// GET /api/commits/{id}/pulse reads the acting member's reading; PUT upserts it. Ownership + the
// 1..5 rating bound are enforced in PulseService / the request DTO; errors render as RFC-7807.
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.PulseDto;
import com.solovis.wcm.commit.dto.PulseRequest;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/commits/{id}/pulse")
public class PulseController {

  private final PulseService service;

  public PulseController(PulseService service) {
    this.service = service;
  }

  @Operation(summary = "Read the acting member's weekly Pulse for this commit (empty when unrated)")
  @GetMapping
  public PulseDto get(@PathVariable UUID id) {
    return service.get(id);
  }

  @Operation(summary = "Upsert the acting member's weekly Pulse (rating 1..5)")
  @PutMapping
  public PulseDto put(@PathVariable UUID id, @Valid @RequestBody PulseRequest request) {
    return service.put(id, request);
  }
}
