// TokenCipherTest — pure unit test for the AES-256-GCM token cipher (U16). Generates a fresh
// 256-bit
// key in-test, asserts encrypt->decrypt round-trips, that two encryptions of the same plaintext
// differ (random IV), that a tampered ciphertext fails to decrypt (GCM auth), and that an
// UNCONFIGURED
// cipher (no key) reports not-configured and fails fast on use. No Spring/DB.
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.SecureRandom;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class TokenCipherTest {

  /** A base64 256-bit key, as ${GRAPH_TOKEN_ENC_KEY} would carry. */
  static String freshKey() {
    byte[] raw = new byte[32];
    new SecureRandom().nextBytes(raw);
    return Base64.getEncoder().encodeToString(raw);
  }

  @Test
  void encryptThenDecryptRoundTrips() {
    TokenCipher cipher = new TokenCipher(freshKey());
    String secret = "ya29.A0AReallyLongDelegatedGraphAccessToken";
    String encrypted = cipher.encrypt(secret);

    assertThat(cipher.isConfigured()).isTrue();
    assertThat(encrypted).isNotEqualTo(secret);
    assertThat(cipher.decrypt(encrypted)).isEqualTo(secret);
  }

  @Test
  void samePlaintextEncryptsToDifferentCiphertexts() {
    TokenCipher cipher = new TokenCipher(freshKey());
    assertThat(cipher.encrypt("token")).isNotEqualTo(cipher.encrypt("token"));
  }

  @Test
  void tamperedCiphertextFailsAuthenticatedDecryption() {
    TokenCipher cipher = new TokenCipher(freshKey());
    String encrypted = cipher.encrypt("token");
    byte[] bytes = Base64.getDecoder().decode(encrypted);
    bytes[bytes.length - 1] ^= 0x01; // flip a bit in the tag
    String tampered = Base64.getEncoder().encodeToString(bytes);

    assertThatThrownBy(() -> cipher.decrypt(tampered)).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void unconfiguredCipherIsNotConfiguredAndFailsFast() {
    TokenCipher cipher = new TokenCipher("");
    assertThat(cipher.isConfigured()).isFalse();
    assertThatThrownBy(() -> cipher.encrypt("x"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("GRAPH_TOKEN_ENC_KEY");
  }
}
