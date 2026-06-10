// OutlookService — the U22 Outlook settings/connection read model + preference upsert for the
// acting
// member (CurrentMemberProvider, KTD6 — never a param). connection() derives CONNECTED from the
// presence of a GraphToken row (GraphTokenService.isConnected) and folds in the member's saved
// preference (createEventOnLock / lastSyncAt). connect() mints the same signed-state Entra
// authorize
// URL as GraphConsentController. disconnect() forgets the token. updateSettings() upserts the
// prefs.
// Also the SYSTEM-side preference seam for the commit.locked calendar consumer (no acting member):
// createEventOnLockEnabled(memberId) gates the sync, recordLockSync(...) persists the Graph event
// id onto the commit's items + stamps lastSyncAt. CB-1: schedule(...) lets the acting MANAGER
// create an ad-hoc Outlook event with one of their reports (row-level authz + connected
// precondition, then CalendarSyncPort.scheduleEvent).
package com.solovis.wcm.integration;

import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.IllegalCommitStateException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.integration.dto.OutlookConnectResponse;
import com.solovis.wcm.integration.dto.OutlookConnectionDto;
import com.solovis.wcm.integration.dto.OutlookSettingsRequest;
import com.solovis.wcm.integration.dto.ScheduleEventRequest;
import com.solovis.wcm.integration.dto.ScheduleEventResponse;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutlookService {

  private final GraphTokenService tokenService;
  private final GraphTokenRepository tokens;
  private final OutlookPreferenceRepository preferences;
  private final GraphProperties props;
  private final GraphConsentState consentState;
  private final CurrentMemberProvider currentMember;
  private final CommitItemRepository commitItems;
  private final MemberRepository members;
  private final CalendarSyncPort calendarSync;

  public OutlookService(
      GraphTokenService tokenService,
      GraphTokenRepository tokens,
      OutlookPreferenceRepository preferences,
      GraphProperties props,
      GraphConsentState consentState,
      CurrentMemberProvider currentMember,
      CommitItemRepository commitItems,
      MemberRepository members,
      CalendarSyncPort calendarSync) {
    this.tokenService = tokenService;
    this.tokens = tokens;
    this.preferences = preferences;
    this.props = props;
    this.consentState = consentState;
    this.currentMember = currentMember;
    this.commitItems = commitItems;
    this.members = members;
    this.calendarSync = calendarSync;
  }

  /**
   * Does {@code memberId} want a calendar event created when they lock their week? Defaults to TRUE
   * when no preference row exists (matching the API's lazy default), so the toggle only ever OPTS
   * OUT. System-side (called by the commit.locked consumer with no acting member).
   */
  @Transactional(readOnly = true)
  public boolean createEventOnLockEnabled(UUID memberId) {
    return preferences
        .findByMemberId(memberId)
        .map(OutlookPreference::isCreateEventOnLock)
        .orElse(true);
  }

  /**
   * Record a successful lock-sync: stamp the Graph event id on every item of the commit
   * (CalendarSyncPort contract — "stored on the commit") and surface {@code at} as the member's
   * lastSyncAt (the Settings "last synced" indicator), lazily creating the preference row. One
   * writable transaction; idempotent (re-recording the same sync rewrites the same values).
   */
  @Transactional
  public void recordLockSync(UUID memberId, UUID commitId, String eventId, Instant at) {
    List<CommitItem> itemsOfCommit = commitItems.findByWeeklyCommitId(commitId);
    itemsOfCommit.forEach(item -> item.setOutlookEventId(eventId));
    commitItems.saveAll(itemsOfCommit);
    OutlookPreference pref =
        preferences
            .findByMemberId(memberId)
            .orElseGet(
                () ->
                    OutlookPreference.builder().memberId(memberId).createEventOnLock(true).build());
    pref.setLastSyncAt(at);
    preferences.save(pref);
  }

  /** GET /integration/outlook — the acting member's connection + preference state. */
  @Transactional(readOnly = true)
  public OutlookConnectionDto connection() {
    Member member = currentMember.currentMember();
    return toDto(member);
  }

  /** POST /integration/outlook/connect — the signed-state Entra authorize URL to redirect to. */
  @Transactional(readOnly = true)
  public OutlookConnectResponse connect() {
    UUID memberId = currentMember.currentMemberId();
    String state = consentState.issue(memberId);
    String url =
        props.authorizeEndpoint()
            + "?client_id="
            + enc(props.getClientId())
            + "&response_type=code"
            + "&redirect_uri="
            + enc(props.getRedirectUri())
            + "&response_mode=query"
            + "&scope="
            + enc(props.getScopes())
            + "&state="
            + enc(state);
    return new OutlookConnectResponse(url);
  }

  /** DELETE /integration/outlook — forget the acting member's delegated token (disconnect). */
  @Transactional
  public OutlookConnectionDto disconnect() {
    Member member = currentMember.currentMember();
    tokens.findByMemberId(member.getId()).ifPresent(tokens::delete);
    return toDto(member);
  }

  /** PUT /integration/outlook/settings — upsert the create-event-on-lock preference. */
  @Transactional
  public OutlookConnectionDto updateSettings(OutlookSettingsRequest request) {
    Member member = currentMember.currentMember();
    OutlookPreference pref =
        preferences
            .findByMemberId(member.getId())
            .orElseGet(
                () ->
                    OutlookPreference.builder()
                        .memberId(member.getId())
                        .createEventOnLock(true)
                        .build());
    pref.setCreateEventOnLock(Boolean.TRUE.equals(request.createEventOnLock()));
    preferences.save(pref);
    return toDto(member);
  }

  /**
   * POST /integration/outlook/schedule (CB-1) — the acting MANAGER schedules an ad-hoc Outlook
   * event (e.g. a 1:1) with one of their OWN reports. Row-level authz: the acting member must BE
   * the report's manager (403 otherwise; unknown report 404). Precondition: the manager has Outlook
   * connected (409 illegal_state otherwise). Defaults: blank subject -> "1:1 — <report>", null
   * duration -> 30 minutes. Deliberately NOT @Transactional: only short repository reads happen
   * here, and the port call is an outbound Graph HTTP request a DB transaction should not span.
   */
  public ScheduleEventResponse schedule(ScheduleEventRequest request) {
    Member acting = currentMember.currentMember();
    Member report =
        members
            .findById(request.reportMemberId())
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        "member " + request.reportMemberId() + " not found"));
    if (!Objects.equals(acting.getId(), report.getManagerId())) {
      throw new ForbiddenException("only the report's manager can schedule an event with them");
    }
    if (!tokenService.isConnected(acting.getId())) {
      throw new IllegalCommitStateException("connect Outlook before scheduling");
    }
    // A 1:1 in the past is never intended; 5-minute grace absorbs clock skew + form dwell time.
    if (request.startDateTime().isBefore(java.time.OffsetDateTime.now().minusMinutes(5))) {
      throw new IllegalArgumentException("startDateTime must be in the future");
    }
    String subject =
        request.subject() == null || request.subject().isBlank()
            ? "1:1 — " + report.getDisplayName()
            : request.subject();
    int durationMinutes = request.durationMinutes() == null ? 30 : request.durationMinutes();
    ScheduledEventCommand cmd =
        new ScheduledEventCommand(
            acting.getId(),
            report.getDisplayName(),
            report.getEmail(),
            subject,
            request.startDateTime(),
            durationMinutes,
            request.note(),
            request.clientRequestId());
    return new ScheduleEventResponse(calendarSync.scheduleEvent(cmd));
  }

  private OutlookConnectionDto toDto(Member member) {
    boolean connected = tokenService.isConnected(member.getId());
    OutlookPreference pref = preferences.findByMemberId(member.getId()).orElse(null);
    boolean createEventOnLock = pref == null || pref.isCreateEventOnLock();
    return new OutlookConnectionDto(
        connected ? OutlookConnectionDto.CONNECTED : OutlookConnectionDto.DISCONNECTED,
        connected ? member.getEmail() : null,
        pref == null ? null : pref.getLastSyncAt(),
        createEventOnLock);
  }

  private static String enc(String s) {
    return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
  }
}
