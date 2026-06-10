// SettingsService — the Settings > Account tab read model + writes for the acting member (KTD6).
// Delegates profile (displayName/timezone) to MemberAccountService, resolves managerName from the
// member's managerId self-FK via MemberRepository (null for a top exec), and owns the
// notification-toggle upsert: notifications() lazy-creates an all-true NotificationPreference on
// first read, like the V8 outlook_preference upsert. All operations are scoped to the acting
// member from CurrentMemberProvider (never a body id), giving row-level isolation; missing
// member -> 404.
package com.solovis.wcm.settings;

import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.SecurityConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberAccountService;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.settings.dto.MemberAccountDto;
import com.solovis.wcm.settings.dto.NotificationPreferenceDto;
import com.solovis.wcm.settings.dto.UpdateMemberAccountDto;
import com.solovis.wcm.settings.dto.UpdateNotificationPreferenceDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

  private final MemberAccountService accounts;
  private final MemberRepository members;
  private final NotificationPreferenceRepository preferences;
  private final CurrentMemberProvider currentMember;

  public SettingsService(
      MemberAccountService accounts,
      MemberRepository members,
      NotificationPreferenceRepository preferences,
      CurrentMemberProvider currentMember) {
    this.accounts = accounts;
    this.members = members;
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

  private MemberAccountDto toAccountDto(Member member) {
    return new MemberAccountDto(
        member.getId(),
        member.getEmail(),
        member.getDisplayName(),
        member.getTimezone(),
        managerNameOf(member),
        member.canReview(),
        canEditRcdo());
  }

  /**
   * The member's manager's displayName via the managerId self-FK; null when top-of-graph (no
   * manager) or the manager row no longer exists.
   */
  private String managerNameOf(Member member) {
    UUID managerId = member.getManagerId();
    return managerId == null
        ? null
        : members.findById(managerId).map(Member::getDisplayName).orElse(null);
  }

  /**
   * True when the acting request carries MANAGER_SCOPE (SCOPE_reconcile:commits) — the same
   * authority that now gates the RCDO edit-tree mutations. The FE uses this to show RCDO "Edit
   * tree" mode to managers (any MANAGER edits the shared strategy tree).
   */
  private static boolean canEditRcdo() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    return auth != null
        && auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals(SecurityConfig.MANAGER_SCOPE));
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
