// OutlookSettingsRequest — body of PUT /api/integration/outlook/settings (U22): whether locking a
// week creates a calendar event. Mirrors the TS OutlookSettingsRequest.
package com.solovis.wcm.integration.dto;

import jakarta.validation.constraints.NotNull;

public record OutlookSettingsRequest(@NotNull Boolean createEventOnLock) {}
