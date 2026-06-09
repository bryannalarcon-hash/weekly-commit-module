// UpdateNotificationPreferenceDto — body of PUT /api/settings/notifications (Settings > Account
// tab).
// All five toggles are required (@NotNull) so the PUT is a full replace of the member's preference
// row, mirroring NotificationPreference's flags.
package com.solovis.wcm.settings.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateNotificationPreferenceDto(
    @NotNull Boolean emailOnLock,
    @NotNull Boolean emailOnReview,
    @NotNull Boolean emailOnReconciled,
    @NotNull Boolean weeklyDigest,
    @NotNull Boolean reminderEmails) {}
