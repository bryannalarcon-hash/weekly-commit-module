// TestJwtConfig — @Profile("test") only: mints + verifies LOCAL RS256 JWTs so MockMvc/IT tests can
// authenticate as a real bearer token (full decode -> validate -> authorities path) without an
// Auth0 tenant. Owns its OWN RSA keypair: the test JwtDecoder bean verifies tokens this config
// signs, and the mint(...) helper issues employee/manager tokens with a chosen subject, email and
// scopes/permissions. Because the keypair + "test-issuer" are local, the PROD issuer-backed decoder
// (SecurityConfig#auth0JwtDecoder, active only when AUTH0_ISSUER_URI is set) REJECTS these forged
// tokens — proven by SecurityIntegrationTest. NEVER ships: profile-gated to test.
package com.solovis.wcm.common;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@Configuration
@Profile("test")
public class TestJwtConfig {

  /** The "issuer" stamped on locally minted test tokens (NOT a real Auth0 issuer). */
  public static final String TEST_ISSUER = "https://test.wcm.local/";

  /** The audience locally minted tokens carry (matches the test-profile AUTH0_AUDIENCE, if set). */
  public static final String TEST_AUDIENCE = "https://api.wcm";

  /** The manager permission tests grant to exercise the SCOPE_reconcile:commits gate. */
  public static final String RECONCILE_PERMISSION = "reconcile:commits";

  private static final KeyPair KEY_PAIR = generateKeyPair();

  /**
   * Test JwtDecoder: verifies the RS256 signature against THIS config's public key. Used when no
   * prod Auth0 issuer is configured (the default test profile), so MockMvc tests run the full
   * decode + validate path on a locally signed token.
   */
  @Bean
  public JwtDecoder testJwtDecoder() {
    return NimbusJwtDecoder.withPublicKey((RSAPublicKey) KEY_PAIR.getPublic()).build();
  }

  /** Sign a local RS256 token for {@code subject} carrying the given Auth0-style permissions. */
  public static String mint(String subject, String email, String... permissions) {
    return mintWithAudience(TEST_ISSUER, subject, email, TEST_AUDIENCE, permissions);
  }

  /** Sign a local RS256 token with an explicit issuer AND audience (used for the bad-aud case). */
  public static String mintWithAudience(
      String issuer, String subject, String email, String audience, String... permissions) {
    try {
      Instant now = Instant.now();
      JWTClaimsSet.Builder claims =
          new JWTClaimsSet.Builder()
              .issuer(issuer)
              .subject(subject)
              .audience(audience)
              .issueTime(Date.from(now))
              .expirationTime(Date.from(now.plus(1, ChronoUnit.HOURS)));
      if (email != null) {
        claims.claim("email", email);
      }
      if (permissions.length > 0) {
        claims.claim("permissions", List.of(permissions));
      }
      SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims.build());
      jwt.sign(new RSASSASigner((RSAPrivateKey) KEY_PAIR.getPrivate()));
      return jwt.serialize();
    } catch (JOSEException e) {
      throw new IllegalStateException("failed to mint test JWT", e);
    }
  }

  /**
   * A local-keypair decoder that mirrors the PROD validator composition (issuer + audience) over
   * locally signed tokens, so a security test can prove an AudienceValidator-equipped decoder
   * rejects a token whose audience is not {@link #TEST_AUDIENCE} — without a real Auth0 tenant.
   */
  public static org.springframework.security.oauth2.jwt.JwtDecoder localDecoderWithAudience(
      String issuer) {
    NimbusJwtDecoder decoder =
        NimbusJwtDecoder.withPublicKey((RSAPublicKey) KEY_PAIR.getPublic()).build();
    decoder.setJwtValidator(
        new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
            org.springframework.security.oauth2.jwt.JwtValidators.createDefaultWithIssuer(issuer),
            new AudienceValidator(TEST_AUDIENCE)));
    return decoder;
  }

  /** MockMvc post-processor that adds an {@code Authorization: Bearer <token>} header. */
  public static RequestPostProcessor bearer(String token) {
    return request -> {
      request.addHeader("Authorization", "Bearer " + token);
      return request;
    };
  }

  /** Convenience: a bearer post-processor for an employee (no manager permission). */
  public static RequestPostProcessor employee(String subject, String email) {
    return bearer(mint(subject, email));
  }

  /** Convenience: a bearer post-processor for a manager (carries reconcile:commits). */
  public static RequestPostProcessor manager(String subject, String email) {
    return bearer(mint(subject, email, RECONCILE_PERMISSION));
  }

  private static KeyPair generateKeyPair() {
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(2048);
      return generator.generateKeyPair();
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("RSA keypair generation failed", e);
    }
  }
}
