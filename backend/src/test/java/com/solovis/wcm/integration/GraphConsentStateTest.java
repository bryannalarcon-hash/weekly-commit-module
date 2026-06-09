// GraphConsentStateTest — pure unit test for the OAuth consent `state` signer/verifier (U16/KTD7).
// Proves the security guarantees the consent callback relies on: a state issued for a member
// verifies back to THAT member; a tampered payload or signature is rejected; an expired state is
// rejected; a state signed under a DIFFERENT key (forged) is rejected; and an UNCONFIGURED instance
// fails fast. No Spring/DB — the HMAC key is minted in-test.
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class GraphConsentStateTest {

  private final String key = TokenCipherTest.freshKey();
  private final GraphConsentState state = new GraphConsentState(key);

  @Test
  void issuedStateVerifiesBackToTheSameMember() {
    UUID member = UUID.randomUUID();
    String issued = state.issue(member);

    assertThat(state.isConfigured()).isTrue();
    assertThat(state.verify(issued)).isEqualTo(member);
  }

  @Test
  void tamperedPayloadIsRejected() {
    UUID member = UUID.randomUUID();
    String issued = state.issue(member);
    // Flip the member id in the payload half while keeping the original signature.
    int dot = issued.indexOf('.');
    UUID attacker = UUID.randomUUID();
    String forgedPayload =
        Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString((attacker + "|" + farFuture()).getBytes(StandardCharsets.UTF_8));
    String tampered = forgedPayload + issued.substring(dot);

    assertThatThrownBy(() -> state.verify(tampered))
        .isInstanceOf(InvalidConsentStateException.class);
  }

  @Test
  void tamperedSignatureIsRejected() {
    String issued = state.issue(UUID.randomUUID());
    String tampered =
        issued.substring(0, issued.length() - 1) + flip(issued.charAt(issued.length() - 1));

    assertThatThrownBy(() -> state.verify(tampered))
        .isInstanceOf(InvalidConsentStateException.class);
  }

  @Test
  void expiredStateIsRejected() {
    // Hand-build a well-signed but already-expired state with this instance's key.
    UUID member = UUID.randomUUID();
    long expiredSec = Instant.now().minusSeconds(60).getEpochSecond();
    String forged = signWith(key, member + "|" + expiredSec);

    assertThatThrownBy(() -> state.verify(forged))
        .isInstanceOf(InvalidConsentStateException.class)
        .hasMessageContaining("expired");
  }

  @Test
  void stateSignedUnderADifferentKeyIsRejected() {
    UUID member = UUID.randomUUID();
    String attackerSigned = signWith(TokenCipherTest.freshKey(), member + "|" + farFuture());

    assertThatThrownBy(() -> state.verify(attackerSigned))
        .isInstanceOf(InvalidConsentStateException.class)
        .hasMessageContaining("signature");
  }

  @Test
  void missingOrMalformedStateIsRejected() {
    assertThatThrownBy(() -> state.verify(null)).isInstanceOf(InvalidConsentStateException.class);
    assertThatThrownBy(() -> state.verify("")).isInstanceOf(InvalidConsentStateException.class);
    assertThatThrownBy(() -> state.verify("no-dot"))
        .isInstanceOf(InvalidConsentStateException.class);
    assertThatThrownBy(() -> state.verify("!!!.@@@"))
        .isInstanceOf(InvalidConsentStateException.class);
  }

  @Test
  void unconfiguredInstanceFailsFast() {
    GraphConsentState unconfigured = new GraphConsentState("");
    assertThat(unconfigured.isConfigured()).isFalse();
    assertThatThrownBy(() -> unconfigured.issue(UUID.randomUUID()))
        .isInstanceOf(IllegalStateException.class);
  }

  // --- helpers ---------------------------------------------------------------------------------

  private static long farFuture() {
    return Instant.now().plusSeconds(600).getEpochSecond();
  }

  private static char flip(char c) {
    return c == 'A' ? 'B' : 'A';
  }

  /** Reproduce GraphConsentState's wire format (base64url(payload).base64url(HMAC)) for a key. */
  private static String signWith(String base64Key, String payload) {
    try {
      byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(Base64.getDecoder().decode(base64Key.trim()), "HmacSHA256"));
      byte[] sig = mac.doFinal(payloadBytes);
      Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
      return enc.encodeToString(payloadBytes) + "." + enc.encodeToString(sig);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
