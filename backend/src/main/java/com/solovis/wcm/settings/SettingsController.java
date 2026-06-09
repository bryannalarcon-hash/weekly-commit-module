// SettingsController — REST surface for the Settings > Account tab (profile + timezone + email
// notification toggles). GET/PUT /api/settings/account and GET/PUT /api/settings/notifications, all
// scoped to the acting member resolved by CurrentMemberProvider inside SettingsService (KTD6 —
// never
// a body id), giving row-level isolation. Routes are just-authenticated (catch-all in
// SecurityConfig).
package com.solovis.wcm.settings;

import com.solovis.wcm.settings.dto.MemberAccountDto;
import com.solovis.wcm.settings.dto.NotificationPreferenceDto;
import com.solovis.wcm.settings.dto.UpdateMemberAccountDto;
import com.solovis.wcm.settings.dto.UpdateNotificationPreferenceDto;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

  private final SettingsService service;

  public SettingsController(SettingsService service) {
    this.service = service;
  }

  @Operation(summary = "The acting member's account profile + timezone")
  @GetMapping("/account")
  public MemberAccountDto account() {
    return service.account();
  }

  @Operation(summary = "Update the acting member's displayName + (validated) timezone")
  @PutMapping("/account")
  public MemberAccountDto updateAccount(@Valid @RequestBody UpdateMemberAccountDto request) {
    return service.updateAccount(request);
  }

  @Operation(summary = "The acting member's email-notification toggles (lazy-created defaults)")
  @GetMapping("/notifications")
  public NotificationPreferenceDto notifications() {
    return service.notifications();
  }

  @Operation(summary = "Update the acting member's email-notification toggles")
  @PutMapping("/notifications")
  public NotificationPreferenceDto updateNotifications(
      @Valid @RequestBody UpdateNotificationPreferenceDto request) {
    return service.updateNotifications(request);
  }
}
