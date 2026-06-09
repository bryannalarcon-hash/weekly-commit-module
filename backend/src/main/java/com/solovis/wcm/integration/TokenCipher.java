// TokenCipher — AES-256-GCM encrypt/decrypt for Graph tokens at rest (U16/KTD7). The 256-bit key is
// read from ${GRAPH_TOKEN_ENC_KEY} (base64); each encrypt uses a fresh random 12-byte IV, and the
// output is base64(IV || ciphertext+tag) so decrypt is self-describing. Construction is env-safe: a
// missing/blank key leaves the cipher UNCONFIGURED (the app still boots) and any encrypt/decrypt
// then
// fails fast with a clear message. Never logs key material or plaintext.
package com.solovis.wcm.integration;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class TokenCipher {

  private static final String TRANSFORM = "AES/GCM/NoPadding";
  private static final int IV_BYTES = 12;
  private static final int TAG_BITS = 128;

  private final SecretKeySpec key; // null when no key is configured
  private final SecureRandom random = new SecureRandom();

  public TokenCipher(@Value("${wcm.graph.token-enc-key:}") String base64Key) {
    this.key = parseKey(base64Key);
  }

  /** True when a usable key was configured (so callers can no-op gracefully when not). */
  public boolean isConfigured() {
    return key != null;
  }

  /** Encrypt {@code plaintext} -> base64(IV || ciphertext+tag). Fails if no key is configured. */
  public String encrypt(String plaintext) {
    requireKey();
    try {
      byte[] iv = new byte[IV_BYTES];
      random.nextBytes(iv);
      Cipher cipher = Cipher.getInstance(TRANSFORM);
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      byte[] out = new byte[iv.length + ct.length];
      System.arraycopy(iv, 0, out, 0, iv.length);
      System.arraycopy(ct, 0, out, iv.length, ct.length);
      return Base64.getEncoder().encodeToString(out);
    } catch (Exception e) {
      throw new IllegalStateException("graph token encryption failed", e);
    }
  }

  /** Decrypt base64(IV || ciphertext+tag) -> plaintext. Fails if no key is configured. */
  public String decrypt(String encoded) {
    requireKey();
    try {
      byte[] all = Base64.getDecoder().decode(encoded);
      byte[] iv = new byte[IV_BYTES];
      System.arraycopy(all, 0, iv, 0, IV_BYTES);
      Cipher cipher = Cipher.getInstance(TRANSFORM);
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] pt = cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES);
      return new String(pt, StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("graph token decryption failed", e);
    }
  }

  private void requireKey() {
    if (key == null) {
      throw new IllegalStateException(
          "GRAPH_TOKEN_ENC_KEY is not configured; cannot encrypt/decrypt Graph tokens");
    }
  }

  private static SecretKeySpec parseKey(String base64Key) {
    if (base64Key == null || base64Key.isBlank()) {
      return null;
    }
    byte[] raw = Base64.getDecoder().decode(base64Key.trim());
    if (raw.length != 16 && raw.length != 24 && raw.length != 32) {
      throw new IllegalArgumentException(
          "GRAPH_TOKEN_ENC_KEY must decode to 16/24/32 bytes (AES-128/192/256)");
    }
    return new SecretKeySpec(raw, "AES");
  }
}
