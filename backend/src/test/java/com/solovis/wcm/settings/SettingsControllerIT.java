// SettingsControllerIT — full-stack MockMvc tests for the Settings > Account tab (profile +
// timezone + notification toggles). Proves: GET account returns the ACTING member's
// profile/timezone;
// PUT updates displayName + a valid timezone and rejects an invalid timezone (400) + blank
// displayName (400); notifications lazy-create all-true defaults then a PUT persists; and a SECOND
// member cannot see the first's settings (acting-member row-level scoping via
// CurrentMemberProvider).
package com.solovis.wcm.settings;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class SettingsControllerIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private NotificationPreferenceRepository preferences;

  private Member member(String slug, MemberRole role, String timezone) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(role)
            .timezone(timezone)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private RequestPostProcessor as(Member m) {
    return m.getRole() == MemberRole.MANAGER
        ? TestJwtConfig.manager(m.getAuth0Subject(), m.getEmail())
        : TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
  }

  @Test
  void getAccountReturnsActingMembersProfileAndTimezone() throws Exception {
    Member m = member("acctRead", MemberRole.MANAGER, "America/New_York");

    mockMvc
        .perform(get("/api/settings/account").with(as(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(m.getId().toString()))
        .andExpect(jsonPath("$.email").value(m.getEmail()))
        .andExpect(jsonPath("$.displayName").value("acctRead"))
        .andExpect(jsonPath("$.timezone").value("America/New_York"))
        .andExpect(jsonPath("$.canReview").value(true));
  }

  @Test
  void getAccountRequiresAuthentication() throws Exception {
    mockMvc.perform(get("/api/settings/account")).andExpect(status().isUnauthorized());
  }

  @Test
  void updateAccountChangesDisplayNameAndTimezone() throws Exception {
    Member m = member("acctUpd", MemberRole.EMPLOYEE, null);

    mockMvc
        .perform(
            put("/api/settings/account")
                .with(as(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Renamed Person\",\"timezone\":\"Europe/Paris\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Renamed Person"))
        .andExpect(jsonPath("$.timezone").value("Europe/Paris"))
        .andExpect(jsonPath("$.canReview").value(false));

    Member reloaded = members.findById(m.getId()).orElseThrow();
    org.junit.jupiter.api.Assertions.assertEquals("Renamed Person", reloaded.getDisplayName());
    org.junit.jupiter.api.Assertions.assertEquals("Europe/Paris", reloaded.getTimezone());
  }

  @Test
  void updateAccountWithBlankTimezoneClearsIt() throws Exception {
    Member m = member("acctClear", MemberRole.EMPLOYEE, "America/Chicago");

    mockMvc
        .perform(
            put("/api/settings/account")
                .with(as(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Still Named\",\"timezone\":\"\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timezone").doesNotExist());
  }

  @Test
  void updateAccountRejectsInvalidTimezone() throws Exception {
    Member m = member("acctBadTz", MemberRole.EMPLOYEE, null);

    mockMvc
        .perform(
            put("/api/settings/account")
                .with(as(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Valid Name\",\"timezone\":\"Not/AZone\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("bad_request"));
  }

  @Test
  void updateAccountRejectsBlankDisplayName() throws Exception {
    Member m = member("acctBlank", MemberRole.EMPLOYEE, null);

    mockMvc
        .perform(
            put("/api/settings/account")
                .with(as(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"  \",\"timezone\":\"America/New_York\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("validation_failed"));
  }

  @Test
  void notificationsLazyCreateDefaultsThenUpdatePersists() throws Exception {
    Member m = member("notif", MemberRole.EMPLOYEE, null);

    // First read: no row exists yet -> lazy-created all-true defaults.
    org.junit.jupiter.api.Assertions.assertTrue(
        preferences.findByMemberId(m.getId()).isEmpty(), "no preference row before first GET");

    mockMvc
        .perform(get("/api/settings/notifications").with(as(m)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.emailOnLock").value(true))
        .andExpect(jsonPath("$.emailOnReview").value(true))
        .andExpect(jsonPath("$.emailOnReconciled").value(true))
        .andExpect(jsonPath("$.weeklyDigest").value(true))
        .andExpect(jsonPath("$.reminderEmails").value(true));

    org.junit.jupiter.api.Assertions.assertTrue(
        preferences.findByMemberId(m.getId()).isPresent(), "row lazy-created on first GET");

    // PUT a partial set of toggles off -> full replace persists.
    mockMvc
        .perform(
            put("/api/settings/notifications")
                .with(as(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"emailOnLock\":false,\"emailOnReview\":true,\"emailOnReconciled\":false,"
                        + "\"weeklyDigest\":true,\"reminderEmails\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.emailOnLock").value(false))
        .andExpect(jsonPath("$.emailOnReview").value(true))
        .andExpect(jsonPath("$.emailOnReconciled").value(false))
        .andExpect(jsonPath("$.weeklyDigest").value(true))
        .andExpect(jsonPath("$.reminderEmails").value(false));

    NotificationPreference saved = preferences.findByMemberId(m.getId()).orElseThrow();
    org.junit.jupiter.api.Assertions.assertFalse(saved.isEmailOnLock());
    org.junit.jupiter.api.Assertions.assertFalse(saved.isReminderEmails());
  }

  @Test
  void notificationsUpdateRejectsMissingToggle() throws Exception {
    Member m = member("notifBad", MemberRole.EMPLOYEE, null);

    // Omit reminderEmails -> @NotNull bean-validation -> 400.
    mockMvc
        .perform(
            put("/api/settings/notifications")
                .with(as(m))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"emailOnLock\":false,\"emailOnReview\":true,\"emailOnReconciled\":false,"
                        + "\"weeklyDigest\":true}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("validation_failed"));
  }

  @Test
  void secondMemberCannotSeeFirstMembersSettings() throws Exception {
    Member first = member("scopeA", MemberRole.MANAGER, "America/Los_Angeles");
    Member second = member("scopeB", MemberRole.EMPLOYEE, "Asia/Tokyo");

    // First member personalizes notifications (all off) and renames themselves.
    mockMvc
        .perform(
            put("/api/settings/notifications")
                .with(as(first))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"emailOnLock\":false,\"emailOnReview\":false,\"emailOnReconciled\":false,"
                        + "\"weeklyDigest\":false,\"reminderEmails\":false}"))
        .andExpect(status().isOk());

    // Second member's account GET returns THEIR OWN profile, never the first's.
    mockMvc
        .perform(get("/api/settings/account").with(as(second)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(second.getId().toString()))
        .andExpect(jsonPath("$.email").value(second.getEmail()))
        .andExpect(jsonPath("$.displayName").value("scopeB"))
        .andExpect(jsonPath("$.timezone").value("Asia/Tokyo"))
        .andExpect(jsonPath("$.canReview").value(false));

    // Second member's notifications GET returns fresh all-true defaults, NOT the first's all-off.
    mockMvc
        .perform(get("/api/settings/notifications").with(as(second)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.emailOnLock").value(true))
        .andExpect(jsonPath("$.reminderEmails").value(true));

    // And the first member's all-off row is unchanged (isolation both ways).
    NotificationPreference firstPref = preferences.findByMemberId(first.getId()).orElseThrow();
    org.junit.jupiter.api.Assertions.assertFalse(firstPref.isEmailOnLock());
    org.junit.jupiter.api.Assertions.assertFalse(firstPref.isWeeklyDigest());
  }
}
