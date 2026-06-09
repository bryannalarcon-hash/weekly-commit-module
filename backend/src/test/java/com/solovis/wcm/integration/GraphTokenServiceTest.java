// GraphTokenServiceTest — hermetic test of the Graph token lifecycle (U16) with a MockWebServer
// token
// endpoint and a mocked repository. Proves: an auth-code exchange stores tokens ENCRYPTED at rest
// (the persisted ciphertext != plaintext, but decrypts back); validAccessToken returns the live
// token
// without a network call when not near expiry; and an expiring token triggers a refresh_token grant
// that updates the stored access token + expiry. No live Entra.
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class GraphTokenServiceTest {

  private MockWebServer entra;
  private GraphTokenRepository repo;
  private TokenCipher cipher;
  private GraphTokenService service;

  @BeforeEach
  void setUp() throws Exception {
    entra = new MockWebServer();
    entra.start();

    repo = mock(GraphTokenRepository.class);
    // save() returns its argument so the service can keep working with the persisted entity.
    when(repo.save(any(GraphToken.class))).thenAnswer(inv -> inv.getArgument(0));
    cipher = new TokenCipher(TokenCipherTest.freshKey());

    GraphProperties props = new GraphProperties();
    props.setClientId("test-client");
    props.setClientSecret("test-secret");
    props.setRedirectUri("http://localhost:8080/api/graph/callback");
    // Point the token endpoint at the mock server (authorize-base + tenant compose the URL).
    props.setAuthorizeBase(entra.url("").toString().replaceAll("/$", ""));
    props.setTenant("common");

    service = new GraphTokenService(repo, cipher, props, RestClient.builder());
  }

  @AfterEach
  void tearDown() throws Exception {
    entra.shutdown();
  }

  @Test
  void exchangeCodeStoresEncryptedTokensThatDecryptBack() throws Exception {
    UUID memberId = UUID.randomUUID();
    when(repo.findByMemberId(memberId)).thenReturn(Optional.empty());
    entra.enqueue(
        new MockResponse()
            .setHeader("Content-Type", "application/json")
            .setBody(
                "{\"access_token\":\"ACCESS-1\",\"refresh_token\":\"REFRESH-1\",\"expires_in\":3600}"));

    GraphToken stored = service.exchangeCode(memberId, "auth-code-xyz");

    // Stored at rest as ciphertext, NOT plaintext, but decrypts back to the real tokens.
    assertThat(stored.getAccessTokenEnc()).isNotEqualTo("ACCESS-1");
    assertThat(stored.getRefreshTokenEnc()).isNotEqualTo("REFRESH-1");
    assertThat(cipher.decrypt(stored.getAccessTokenEnc())).isEqualTo("ACCESS-1");
    assertThat(cipher.decrypt(stored.getRefreshTokenEnc())).isEqualTo("REFRESH-1");
    assertThat(stored.getExpiresAt()).isAfter(Instant.now());

    RecordedRequest req = entra.takeRequest();
    assertThat(req.getPath()).isEqualTo("/common/oauth2/v2.0/token");
    String form = req.getBody().readUtf8();
    assertThat(form).contains("grant_type=authorization_code").contains("code=auth-code-xyz");
  }

  @Test
  void validAccessTokenReturnsLiveTokenWithoutRefreshWhenFresh() {
    UUID memberId = UUID.randomUUID();
    GraphToken fresh =
        GraphToken.builder()
            .memberId(memberId)
            .accessTokenEnc(cipher.encrypt("FRESH-ACCESS"))
            .refreshTokenEnc(cipher.encrypt("REFRESH"))
            .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
            .build();
    when(repo.findByMemberId(memberId)).thenReturn(Optional.of(fresh));

    assertThat(service.validAccessToken(memberId)).isEqualTo("FRESH-ACCESS");
    // No network call was needed (queue still empty); MockWebServer would block if it had been.
    assertThat(entra.getRequestCount()).isZero();
  }

  @Test
  void validAccessTokenRefreshesWhenNearExpiry() throws Exception {
    UUID memberId = UUID.randomUUID();
    GraphToken expiring =
        GraphToken.builder()
            .memberId(memberId)
            .accessTokenEnc(cipher.encrypt("OLD-ACCESS"))
            .refreshTokenEnc(cipher.encrypt("OLD-REFRESH"))
            .expiresAt(Instant.now().plus(1, ChronoUnit.MINUTES)) // within the 5-min skew
            .build();
    when(repo.findByMemberId(memberId)).thenReturn(Optional.of(expiring));
    entra.enqueue(
        new MockResponse()
            .setHeader("Content-Type", "application/json")
            .setBody(
                "{\"access_token\":\"NEW-ACCESS\",\"refresh_token\":\"NEW-REFRESH\",\"expires_in\":3600}"));

    String token = service.validAccessToken(memberId);

    assertThat(token).isEqualTo("NEW-ACCESS");
    RecordedRequest req = entra.takeRequest();
    assertThat(req.getBody().readUtf8())
        .contains("grant_type=refresh_token")
        .contains("refresh_token=OLD-REFRESH");
    // The stored token was rotated to the new values.
    assertThat(cipher.decrypt(expiring.getAccessTokenEnc())).isEqualTo("NEW-ACCESS");
    assertThat(cipher.decrypt(expiring.getRefreshTokenEnc())).isEqualTo("NEW-REFRESH");
  }
}
