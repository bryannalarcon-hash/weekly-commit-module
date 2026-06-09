// AudienceValidator — OAuth2TokenValidator that asserts an Auth0 access token was minted FOR this
// API (its "aud" claim contains our configured AUTH0_AUDIENCE). Auth0 issues tokens whose audience
// is the API identifier; checking it closes the "valid token for a different API" confusion path.
// Composed with the default issuer/expiry validators in SecurityConfig via
// DelegatingOAuth2TokenValidator.
package com.solovis.wcm.common;

import java.util.List;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

public class AudienceValidator implements OAuth2TokenValidator<Jwt> {

  private static final OAuth2Error MISSING_AUDIENCE =
      new OAuth2Error(
          "invalid_token",
          "the required audience is missing from the token",
          "https://tools.ietf.org/html/rfc6750#section-3.1");

  private final String requiredAudience;

  public AudienceValidator(String requiredAudience) {
    this.requiredAudience = requiredAudience;
  }

  @Override
  public OAuth2TokenValidatorResult validate(Jwt token) {
    List<String> audiences = token.getAudience();
    if (audiences != null && audiences.contains(requiredAudience)) {
      return OAuth2TokenValidatorResult.success();
    }
    return OAuth2TokenValidatorResult.failure(MISSING_AUDIENCE);
  }
}
