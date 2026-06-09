// SecurityConfig — turns the API into an Auth0-backed OAuth2 resource server (U15). The single
// SecurityFilterChain is ALWAYS active: it permits the health/openapi probes AND the browser-borne
// Graph consent callback (which carries no bearer token and is guarded by a signed `state`
// instead),
// gates manager-only routes (rollup, review, reconcile transitions) behind SCOPE_reconcile:commits,
// and requires a valid JWT everywhere else; bearer auth failures render as 401/403 with an RFC-7807
// problem+json body (ProblemAuthHandlers), matching the service-layer error shape. Auth0
// "permissions" are mapped
// to SCOPE_ authorities. The PROD RS256 JwtDecoder (issuer-uri + audience validation) is built ONLY
// when AUTH0_ISSUER_URI is set, so the test profile (TestJwtConfig's local-keypair decoder) and a
// bare local boot still start; that prod decoder also rejects forged test-JWTs (wrong issuer/JWKS).
package com.solovis.wcm.common;

import java.util.Collection;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

// NOT active under the "e2e" profile: the hermetic E2E path (E2eSecurityConfig) replaces this
// JWT-backed chain with an X-Debug-Member header authenticator (KTD13), so a real browser can
// drive the federated app without an Auth0 tenant. Prod/default/test keep this JWT-only chain.
@Configuration
@Profile("!e2e")
public class SecurityConfig {

  /** Auth0 permission required by manager-only routes (mapped to a SCOPE_ authority). */
  public static final String MANAGER_SCOPE = "SCOPE_reconcile:commits";

  /** The Auth0 custom claim carrying the user's API permissions (when RBAC is enabled). */
  private static final String PERMISSIONS_CLAIM = "permissions";

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth
                    // Liveness + machine-readable contract are open (no token).
                    .requestMatchers("/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                    // OAuth consent callback: Entra redirects the user's BROWSER here with NO
                    // bearer token, so it cannot be JWT-gated. Its guard is the signed `state`
                    // (GraphConsentState HMAC + expiry) it verifies to derive the acting member.
                    .requestMatchers(HttpMethod.GET, "/api/graph/callback")
                    .permitAll()
                    // Manager-only routes: rollup, the review queue, per-commit review, and the
                    // reconcile transitions.
                    .requestMatchers(HttpMethod.GET, "/api/rollup", "/api/rollup/**")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.GET, "/api/review-queue")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.POST, "/api/commits/*/review")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.POST, "/api/commits/*/reconcile")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.POST, "/api/commits/*/reconciled")
                    .hasAuthority(MANAGER_SCOPE)
                    // Everything else needs a valid token (row-level authz then runs in services).
                    .anyRequest()
                    .authenticated())
        // Filter-chain denials carry an RFC-7807 problem+json body (code unauthorized/forbidden),
        // matching the service-layer ApiExceptionHandler shape instead of an empty 401/403 body.
        .exceptionHandling(
            ex ->
                ex.authenticationEntryPoint(ProblemAuthHandlers.unauthorizedEntryPoint())
                    .accessDeniedHandler(ProblemAuthHandlers.forbiddenHandler()))
        .oauth2ResourceServer(
            oauth2 ->
                oauth2
                    .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                    // The resource-server filter installs its OWN bearer
                    // entry-point/denied-handler;
                    // override them so bearer-token 401/403 also render problem+json (not empty).
                    .authenticationEntryPoint(ProblemAuthHandlers.unauthorizedEntryPoint())
                    .accessDeniedHandler(ProblemAuthHandlers.forbiddenHandler()));
    return http.build();
  }

  /**
   * Map Auth0 access-token claims to authorities: the standard space-delimited {@code scope} claim
   * AND Auth0's {@code permissions} array both become {@code SCOPE_*} authorities, so RBAC
   * permissions like {@code reconcile:commits} gate routes the same way a scope would.
   */
  @Bean
  public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter scopes = new JwtGrantedAuthoritiesConverter();
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(
        jwt -> {
          Collection<GrantedAuthority> authorities = scopes.convert(jwt);
          List<String> permissions = jwt.getClaimAsStringList(PERMISSIONS_CLAIM);
          if (permissions != null) {
            permissions.stream()
                .filter(p -> p != null && !p.isBlank())
                .map(p -> new SimpleGrantedAuthority("SCOPE_" + p))
                .forEach(authorities::add);
          }
          return authorities;
        });
    return converter;
  }

  /**
   * PROD RS256 decoder: validates the JWT signature against the Auth0 JWKS at {@code issuer-uri},
   * then the issuer/expiry (default) AND our audience. Built only when AUTH0_ISSUER_URI is set —
   * absent it, the test profile's local-keypair JwtDecoder is used instead, and this prod decoder
   * (when present) rejects forged test-JWTs because their issuer/signature don't match Auth0.
   */
  @Bean
  @Conditional(Auth0IssuerConfiguredCondition.class)
  public JwtDecoder auth0JwtDecoder(
      @org.springframework.beans.factory.annotation.Value("${wcm.auth0.issuer-uri}") String issuer,
      @org.springframework.beans.factory.annotation.Value("${wcm.auth0.audience:}")
          String audience) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(issuer).build();
    OAuth2TokenValidator<Jwt> withIssuer = JwtValidators.createDefaultWithIssuer(issuer);
    OAuth2TokenValidator<Jwt> validator =
        audience == null || audience.isBlank()
            ? withIssuer
            : new DelegatingOAuth2TokenValidator<>(withIssuer, new AudienceValidator(audience));
    decoder.setJwtValidator(validator);
    return decoder;
  }
}
