// GraphTokenService — owns the delegated-Graph token lifecycle for a member (U16/KTD7). Exchanges
// an
// authorization code for tokens at the Entra token endpoint (POST /{tenant}/oauth2/v2.0/token),
// stores them ENCRYPTED via TokenCipher (one GraphToken row per member), and on read returns a
// valid
// access token — refreshing with the refresh_token grant when within a skew of expiry. The token
// endpoint is called with Spring's RestClient (form-encoded); the client is built from an injected
// RestClient.Builder so tests can point it at a MockWebServer. No token value is ever logged.
package com.solovis.wcm.integration;

import com.solovis.wcm.common.ResourceNotFoundException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Service
public class GraphTokenService {

  /** Refresh when the access token has this little (or less) life left. */
  private static final Duration REFRESH_SKEW = Duration.ofMinutes(5);

  private final GraphTokenRepository tokens;
  private final TokenCipher cipher;
  private final GraphProperties props;
  private final RestClient tokenClient;

  public GraphTokenService(
      GraphTokenRepository tokens,
      TokenCipher cipher,
      GraphProperties props,
      RestClient.Builder restClientBuilder) {
    this.tokens = tokens;
    this.cipher = cipher;
    this.props = props;
    // Base URL is the full token endpoint; calls POST "" (empty path) with a form body.
    this.tokenClient = restClientBuilder.baseUrl(props.tokenEndpoint()).build();
  }

  /**
   * Exchange an authorization code (from the consent redirect) for tokens and persist them
   * encrypted for {@code memberId}, upserting the member's single GraphToken row. Returns the
   * stored token.
   */
  @Transactional
  public GraphToken exchangeCode(UUID memberId, String code) {
    TokenResponse resp = postToken(authCodeForm(code));
    return store(memberId, resp);
  }

  /**
   * Return a currently-valid access token for {@code memberId}, refreshing first if it is within
   * REFRESH_SKEW of expiry (and a refresh token is present). Throws if the member never consented.
   */
  @Transactional
  public String validAccessToken(UUID memberId) {
    GraphToken token =
        tokens
            .findByMemberId(memberId)
            .orElseThrow(
                () -> new ResourceNotFoundException("no Graph token for member " + memberId));
    if (needsRefresh(token) && token.getRefreshTokenEnc() != null) {
      token = refresh(token);
    }
    return cipher.decrypt(token.getAccessTokenEnc());
  }

  /** True when {@code memberId} has consented (a token row exists). */
  @Transactional(readOnly = true)
  public boolean isConnected(UUID memberId) {
    return tokens.findByMemberId(memberId).isPresent();
  }

  // --- internals -------------------------------------------------------------------------------

  private boolean needsRefresh(GraphToken token) {
    return token.isExpiredAt(Instant.now().plus(REFRESH_SKEW));
  }

  private GraphToken refresh(GraphToken token) {
    TokenResponse resp = postToken(refreshForm(cipher.decrypt(token.getRefreshTokenEnc())));
    token.setAccessTokenEnc(cipher.encrypt(resp.accessToken()));
    if (resp.refreshToken() != null) {
      token.setRefreshTokenEnc(cipher.encrypt(resp.refreshToken()));
    }
    token.setExpiresAt(Instant.now().plusSeconds(resp.expiresInSeconds()));
    return tokens.save(token);
  }

  private GraphToken store(UUID memberId, TokenResponse resp) {
    GraphToken token =
        tokens
            .findByMemberId(memberId)
            .orElseGet(() -> GraphToken.builder().memberId(memberId).build());
    token.setAccessTokenEnc(cipher.encrypt(resp.accessToken()));
    if (resp.refreshToken() != null) {
      token.setRefreshTokenEnc(cipher.encrypt(resp.refreshToken()));
    }
    token.setExpiresAt(Instant.now().plusSeconds(resp.expiresInSeconds()));
    return tokens.save(token);
  }

  private MultiValueMap<String, String> authCodeForm(String code) {
    MultiValueMap<String, String> form = baseForm();
    form.add("grant_type", "authorization_code");
    form.add("code", code);
    form.add("redirect_uri", props.getRedirectUri());
    return form;
  }

  private MultiValueMap<String, String> refreshForm(String refreshToken) {
    MultiValueMap<String, String> form = baseForm();
    form.add("grant_type", "refresh_token");
    form.add("refresh_token", refreshToken);
    return form;
  }

  private MultiValueMap<String, String> baseForm() {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("client_id", props.getClientId());
    form.add("scope", props.getScopes());
    if (props.getClientSecret() != null && !props.getClientSecret().isBlank()) {
      form.add("client_secret", props.getClientSecret());
    }
    return form;
  }

  @SuppressWarnings("unchecked")
  private TokenResponse postToken(MultiValueMap<String, String> form) {
    Map<String, Object> body =
        tokenClient
            .post()
            .contentType(org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(Map.class);
    if (body == null || body.get("access_token") == null) {
      throw new IllegalStateException("Graph token endpoint returned no access_token");
    }
    Object expires = body.get("expires_in");
    long expiresIn = expires instanceof Number n ? n.longValue() : 3600L;
    return new TokenResponse(
        (String) body.get("access_token"), (String) body.get("refresh_token"), expiresIn);
  }

  /** The subset of the Entra token response this service consumes. */
  private record TokenResponse(String accessToken, String refreshToken, long expiresInSeconds) {}
}
