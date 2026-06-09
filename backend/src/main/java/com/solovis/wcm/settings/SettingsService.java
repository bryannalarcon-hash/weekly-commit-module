// SettingsService — the Settings > Account tab read model + writes for the acting member (KTD6).
// Delegates profile (displayName/timezone) to MemberAccountService and owns the notification-toggle
// upsert: notifications() lazy-creates an all-true NotificationPreference on first read, like the
// V8 outlook_preference upsert. All operations are scoped to the acting member from
// CurrentMemberProvider (never a body id), giving row-level isolation; missing member -> 404.
package com.solovis.wcm.settings;

import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberAccountService;
import com.solovis.wcm.settings.dto.MemberAccountDto;
import com.solovis.wcm.settings.dto.NotificationPreferenceDto;
import com.solovis.wcm.settings.dto.UpdateMemberAccountDto;
import com.solovis.wcm.settings.dto.UpdateNotificationPreferenceDto;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

  private final MemberAccountService accounts;
  private final NotificationPreferenceRepository preferences;
  private final CurrentMemberProvider currentMember;

  public SettingsService(
      MemberAccountService accounts,
      NotificationPreferenceRepository preferences,
      CurrentMemberProvider currentMember) {
    this.accounts = accounts;
    this.preferences = preferences;
    this.currentMember = currentMember;
  }

  /** GET /api/settings/account — the acting member's profile + timezone. */
  @Transactional(readOnly = true)
  public MemberAccountDto account() {
    return toAccountDto(accounts.currentAccount());
  }

  /**
   * PUT /api/settings/account — update displayName + timezone (validated) for the acting member.
   */
  @Transactional
  public MemberAccountDto updateAccount(UpdateMemberAccountDto request) {
    Member updated = accounts.updateAccount(request.displayName(), request.timezone());
    return toAccountDto(updated);
  }

  /**
   * GET /api/settings/notifications — the acting member's toggles, lazy-creating an all-true
   * preference row on first read (upsert style, mirrors V8 outlook_preference).
   */
  @Transactional
  public NotificationPreferenceDto notifications() {
    return toNotificationDto(loadOrCreate(currentMember.currentMemberId()));
  }

  /** PUT /api/settings/notifications — full replace of the acting member's five toggles. */
  @Transactional
  public NotificationPreferenceDto updateNotifications(UpdateNotificationPreferenceDto request) {
    NotificationPreference pref = loadOrCreate(currentMember.currentMemberId());
    pref.setEmailOnLock(Boolean.TRUE.equals(request.emailOnLock()));
    pref.setEmailOnReview(Boolean.TRUE.equals(request.emailOnReview()));
    pref.setEmailOnReconciled(Boolean.TRUE.equals(request.emailOnReconciled()));
    pref.setWeeklyDigest(Boolean.TRUE.equals(request.weeklyDigest()));
    pref.setReminderEmails(Boolean.TRUE.equals(request.reminderEmails()));
    return toNotificationDto(preferences.save(pref));
  }

  private NotificationPreference loadOrCreate(UUID memberId) {
    return preferences
        .findByMemberId(memberId)
        .orElseGet(
            () ->
                preferences.save(
                    NotificationPreference.builder()
                        .memberId(memberId)
                        .emailOnLock(true)
                        .emailOnReview(true)
                        .emailOnReconciled(true)
                        .weeklyDigest(true)
                        .reminderEmails(true)
                        .build()));
  }

  private static MemberAccountDto toAccountDto(Member member) {
    return new MemberAccountDto(
        member.getId(),
        member.getEmail(),
        member.getDisplayName(),
        member.getTimezone(),
        member.canReview());
  }

  private static NotificationPreferenceDto toNotificationDto(NotificationPreference pref) {
    return new NotificationPreferenceDto(
        pref.isEmailOnLock(),
        pref.isEmailOnReview(),
        pref.isEmailOnReconciled(),
        pref.isWeeklyDigest(),
        pref.isReminderEmails());
  }
}
