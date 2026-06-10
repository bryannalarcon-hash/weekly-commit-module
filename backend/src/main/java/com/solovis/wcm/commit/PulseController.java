// PulseController — REST surface for the weekly Pulse (U19 thin Pulse), RTK-Query friendly.
// GET /api/commits/{id}/pulse reads the reading (owner OR the owner's direct manager); PUT upserts
// it (owner-only, and only while DRAFT/LOCKED/RECONCILING — frozen weeks 409). Authz, the freeze
// guard and the 1..5 rating bound live in PulseService / the request DTO; errors render RFC-7807.
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

  @Operation(
      summary =
          "Read the weekly Pulse for this commit — owner or the owner's direct manager (empty when"
              + " unrated)")
  @GetMapping
  public PulseDto get(@PathVariable UUID id) {
    return service.get(id);
  }

  @Operation(
      summary =
          "Upsert the owner's weekly Pulse (rating 1..5); 409 once the week is RECONCILED/frozen")
  @PutMapping
  public PulseDto put(@PathVariable UUID id, @Valid @RequestBody PulseRequest request) {
    return service.put(id, request);
  }
}
