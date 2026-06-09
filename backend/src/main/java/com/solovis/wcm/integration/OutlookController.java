// OutlookController — REST surface for the Outlook settings/connection screen (U22), RTK-Query
// friendly. GET /api/integration/outlook returns the acting member's connection + preference state;
// POST /connect returns the Entra authorize URL; DELETE disconnects; PUT /settings upserts the
// create-event-on-lock preference. Acting member from CurrentMemberProvider; logic in
// OutlookService.
package com.solovis.wcm.integration;

import com.solovis.wcm.integration.dto.OutlookConnectResponse;
import com.solovis.wcm.integration.dto.OutlookConnectionDto;
import com.solovis.wcm.integration.dto.OutlookSettingsRequest;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/integration/outlook")
public class OutlookController {

  private final OutlookService service;

  public OutlookController(OutlookService service) {
    this.service = service;
  }

  @Operation(summary = "The acting member's Outlook connection + sync preference")
  @GetMapping
  public OutlookConnectionDto connection() {
    return service.connection();
  }

  @Operation(summary = "Begin Outlook consent: the Entra authorize URL to redirect to")
  @PostMapping("/connect")
  public OutlookConnectResponse connect() {
    return service.connect();
  }

  @Operation(summary = "Disconnect Outlook (forget the delegated token)")
  @DeleteMapping
  public OutlookConnectionDto disconnect() {
    return service.disconnect();
  }

  @Operation(summary = "Update the create-event-on-lock sync preference")
  @PutMapping("/settings")
  public OutlookConnectionDto updateSettings(@Valid @RequestBody OutlookSettingsRequest request) {
    return service.updateSettings(request);
  }
}
