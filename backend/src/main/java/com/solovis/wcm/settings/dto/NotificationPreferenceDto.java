// NotificationPreferenceDto — the acting member's email-notification toggles (Settings > Account).
// Response of GET/PUT /api/settings/notifications: the five booleans mirroring
// NotificationPreference
// (lock/review/reconciled/weekly-digest/reminder emails). Lazy-created with all-true defaults on
// first GET.
package com.solovis.wcm.settings.dto;

public record NotificationPreferenceDto(
    boolean emailOnLock,
    boolean emailOnReview,
    boolean emailOnReconciled,
    boolean weeklyDigest,
    boolean reminderEmails) {}
