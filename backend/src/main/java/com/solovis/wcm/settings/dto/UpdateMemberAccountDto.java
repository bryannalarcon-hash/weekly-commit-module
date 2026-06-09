// UpdateMemberAccountDto — body of PUT /api/settings/account (Settings > Account tab).
// displayName is required (@NotBlank). timezone is optional; when non-blank it must be a valid
// java.time.ZoneId (validated in SettingsService -> 400 via IllegalArgumentException) — blank/null
// clears it. email is NOT editable here (identity-bound), so it is intentionally absent.
package com.solovis.wcm.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateMemberAccountDto(
    @NotBlank @Size(max = 160) String displayName, @Size(max = 63) String timezone) {}
