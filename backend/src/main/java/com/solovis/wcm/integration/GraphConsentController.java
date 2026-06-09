// GraphConsentController — the delegated-Graph OAuth consent endpoints (U16/U22 seam):
//   GET /api/graph/connect  -> JWT-secured; 302 to the Entra authorize URL carrying a SIGNED state.
//   GET /api/graph/callback -> permitAll (a tokenless browser redirect); the member is derived FROM
//                              the verified `state`, never from the security context.
//   GET /api/graph/status   -> JWT-secured; { connected: bool } for the acting member.
// /connect and /status resolve the acting member from the JWT (CurrentMemberProvider, never a
// param).
// The callback CANNOT trust a bearer token (Entra redirects the browser with none), so it trusts
// the
// HMAC-signed, short-lived `state` minted by /connect (GraphConsentState): that binds the acting
// member into a tamper-proof value and is the CSRF / authorization-code-injection guard. A member
// can
// thus only connect/inspect their OWN Outlook link, and a forged/stale callback is rejected (400).
package com.solovis.wcm.integration;

import com.solovis.wcm.common.CurrentMemberProvider;
import io.swagger.v3.oas.annotations.Operation;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/graph")
public class GraphConsentController {

  private final GraphTokenService tokenService;
  private final GraphProperties props;
  private final CurrentMemberProvider currentMember;
  private final GraphConsentState consentState;

  public GraphConsentController(
      GraphTokenService tokenService,
      GraphProperties props,
      CurrentMemberProvider currentMember,
      GraphConsentState consentState) {
    this.tokenService = tokenService;
    this.props = props;
    this.currentMember = currentMember;
    this.consentState = consentState;
  }

  @Operation(summary = "Begin Outlook consent: redirect to the Entra authorize URL (signed state)")
  @GetMapping("/connect")
  public ResponseEntity<Void> connect() {
    UUID memberId = currentMember.currentMemberId();
    // Signed, short-lived state binding the acting member. The tokenless callback verifies it to
    // attribute the exchange — this (not the security context) is the CSRF / code-injection guard.
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
    return ResponseEntity.status(302).location(URI.create(url)).build();
  }

  @Operation(summary = "Outlook consent callback: verify state, exchange the code, store the token")
  @GetMapping("/callback")
  public Map<String, Object> callback(
      @RequestParam("code") String code,
      @RequestParam(value = "state", required = false) String state) {
    // The member is derived from the VERIFIED state (HMAC + expiry), not from any session/principal
    // hitting this open endpoint — rejecting forged/replayed callbacks
    // (InvalidConsentStateException
    // -> 400) before any token is bound to a member row.
    UUID memberId = consentState.verify(state);
    tokenService.exchangeCode(memberId, code);
    return Map.of("connected", true, "memberId", memberId.toString());
  }

  @Operation(summary = "Whether the acting member has connected Outlook")
  @GetMapping("/status")
  public Map<String, Object> status() {
    UUID memberId = currentMember.currentMemberId();
    return Map.of("connected", tokenService.isConnected(memberId));
  }

  private static String enc(String s) {
    return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
  }
}
