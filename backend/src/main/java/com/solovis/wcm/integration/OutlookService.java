// OutlookService — the U22 Outlook settings/connection read model + preference upsert for the
// acting
// member (CurrentMemberProvider, KTD6 — never a param). connection() derives CONNECTED from the
// presence of a GraphToken row (GraphTokenService.isConnected) and folds in the member's saved
// preference (createEventOnLock / lastSyncAt). connect() mints the same signed-state Entra
// authorize
// URL as GraphConsentController. disconnect() forgets the token. updateSettings() upserts the
// prefs.
package com.solovis.wcm.integration;

import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.integration.dto.OutlookConnectResponse;
import com.solovis.wcm.integration.dto.OutlookConnectionDto;
import com.solovis.wcm.integration.dto.OutlookSettingsRequest;
import com.solovis.wcm.member.Member;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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

  public OutlookService(
      GraphTokenService tokenService,
      GraphTokenRepository tokens,
      OutlookPreferenceRepository preferences,
      GraphProperties props,
      GraphConsentState consentState,
      CurrentMemberProvider currentMember) {
    this.tokenService = tokenService;
    this.tokens = tokens;
    this.preferences = preferences;
    this.props = props;
    this.consentState = consentState;
    this.currentMember = currentMember;
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
