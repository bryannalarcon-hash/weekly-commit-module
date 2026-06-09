// GraphConsentState — the OAuth `state` signer/verifier for the delegated-Graph consent flow
// (U16/KTD7). The browser carries `state` across the Entra round-trip with NO bearer token, so the
// callback cannot trust the security context to identify who initiated /connect. This class binds
// the acting member into a tamper-proof, short-lived state value: state =
// base64url(memberId|expiry)
// "." base64url(HMAC-SHA256(payload)). On callback we VERIFY the HMAC (constant-time) and the
// expiry
// and derive the member FROM the validated state — defeating CSRF / authorization-code injection.
// The HMAC key is the same 256-bit secret used for token encryption (wcm.graph.token-enc-key,
// base64),
// so the flow shares one configured secret; a missing key leaves this UNCONFIGURED and signing
// fails
// fast. Stateless by design (no server-side nonce store): the signature + expiry are the guard.
package com.solovis.wcm.integration;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class GraphConsentState {

  private static final String HMAC_ALG = "HmacSHA256";

  /** A signed state is only valid for this long after issuance (bounds the CSRF/replay window). */
  private static final Duration TTL = Duration.ofMinutes(10);

  private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
  private static final Base64.Decoder B64D = Base64.getUrlDecoder();

  private final SecretKeySpec key; // null when no key is configured

  public GraphConsentState(@Value("${wcm.graph.token-enc-key:}") String base64Key) {
    this.key = parseKey(base64Key);
  }

  /** True when a usable signing key was configured (so callers can branch when not). */
  public boolean isConfigured() {
    return key != null;
  }

  /**
   * Sign a state value binding {@code memberId} for the consent round-trip. The returned opaque
   * string carries the member id and an expiry, authenticated by an HMAC so the callback can trust
   * it without a bearer token. Fails fast if no signing key is configured.
   */
  public String issue(UUID memberId) {
    requireKey();
    long expiresAtEpochSec = Instant.now().plus(TTL).getEpochSecond();
    String payload = memberId.toString() + "|" + expiresAtEpochSec;
    byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
    return B64.encodeToString(payloadBytes) + "." + B64.encodeToString(hmac(payloadBytes));
  }

  /**
   * Verify a state returned on the consent callback and return the member it was issued for. The
   * HMAC is checked in constant time and the embedded expiry is enforced; any tampering, malformed
   * value, unknown signing key, or expiry yields an {@link InvalidConsentStateException} — the
   * callback rejects rather than trusting whatever principal hit it.
   */
  public UUID verify(String state) {
    requireKey();
    if (state == null || state.isBlank()) {
      throw new InvalidConsentStateException("missing consent state");
    }
    int dot = state.indexOf('.');
    if (dot <= 0 || dot == state.length() - 1) {
      throw new InvalidConsentStateException("malformed consent state");
    }
    byte[] payloadBytes;
    byte[] presentedMac;
    try {
      payloadBytes = B64D.decode(state.substring(0, dot));
      presentedMac = B64D.decode(state.substring(dot + 1));
    } catch (IllegalArgumentException e) {
      throw new InvalidConsentStateException("undecodable consent state");
    }
    // Constant-time MAC comparison: reject any tampered/forged state before parsing the payload.
    if (!MessageDigest.isEqual(hmac(payloadBytes), presentedMac)) {
      throw new InvalidConsentStateException("consent state signature mismatch");
    }
    String payload = new String(payloadBytes, StandardCharsets.UTF_8);
    int sep = payload.indexOf('|');
    if (sep <= 0) {
      throw new InvalidConsentStateException("malformed consent state payload");
    }
    UUID memberId;
    long expiresAtEpochSec;
    try {
      memberId = UUID.fromString(payload.substring(0, sep));
      expiresAtEpochSec = Long.parseLong(payload.substring(sep + 1));
    } catch (RuntimeException e) {
      throw new InvalidConsentStateException("malformed consent state payload");
    }
    if (Instant.now().getEpochSecond() > expiresAtEpochSec) {
      throw new InvalidConsentStateException("expired consent state");
    }
    return memberId;
  }

  private byte[] hmac(byte[] payload) {
    try {
      Mac mac = Mac.getInstance(HMAC_ALG);
      mac.init(key);
      return mac.doFinal(payload);
    } catch (Exception e) {
      throw new IllegalStateException("consent state signing failed", e);
    }
  }

  private void requireKey() {
    if (key == null) {
      throw new IllegalStateException(
          "wcm.graph.token-enc-key is not configured; cannot sign/verify consent state");
    }
  }

  private static SecretKeySpec parseKey(String base64Key) {
    if (base64Key == null || base64Key.isBlank()) {
      return null;
    }
    byte[] raw = Base64.getDecoder().decode(base64Key.trim());
    return new SecretKeySpec(raw, HMAC_ALG);
  }
}
