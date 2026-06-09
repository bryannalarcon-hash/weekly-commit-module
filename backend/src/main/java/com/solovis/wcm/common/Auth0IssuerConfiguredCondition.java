// Auth0IssuerConfiguredCondition — gates the PROD RS256 JwtDecoder bean on a NON-BLANK
// wcm.auth0.issuer-uri (from ${AUTH0_ISSUER_URI}). Plain @ConditionalOnProperty treats the
// empty-string default (`${AUTH0_ISSUER_URI:}`) as "present" and would wrongly activate the prod
// decoder in tests/bare boots; this condition explicitly requires a real, non-blank issuer so the
// test profile's local-keypair decoder (TestJwtConfig) is used instead when Auth0 isn't configured.
package com.solovis.wcm.common;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

public class Auth0IssuerConfiguredCondition implements Condition {

  @Override
  public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
    String issuer = context.getEnvironment().getProperty("wcm.auth0.issuer-uri");
    return issuer != null && !issuer.isBlank();
  }
}
