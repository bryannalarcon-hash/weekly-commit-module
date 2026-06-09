// E2eSecurityConfig — the HERMETIC E2E SecurityFilterChain (KTD13), active ONLY under the "e2e"
// profile. It REPLACES the JWT resource-server chain (SecurityConfig, @Profile("!e2e")) so a real
// browser can drive the federated app end-to-end WITHOUT an Auth0 tenant: a request authenticates
// from an X-Debug-Member header whose value names a SEEDED member (by email, e.g.
// "lena@solovis.test",
// or by slug, e.g. "lena"). The resolved member's id becomes the auth principal (read back by
// DebugHeaderCurrentMemberProvider), and MANAGER members are granted SCOPE_reconcile:commits so the
// SAME manager-only route guards (rollup / review / reconcile transitions) apply as in prod. This
// is
// a test-only path — it NEVER ships in prod and is NOT a product fallback. Anonymous (no/unknown
// header) requests stay unauthenticated → 401/403 exactly as the JWT chain would render them,
// including the same RFC-7807 problem+json bodies (ProblemAuthHandlers) on those denials.
package com.solovis.wcm.common;

import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@Profile("e2e")
public class E2eSecurityConfig {

  /** The hermetic identity header a browser/Cypress sends instead of a Bearer token. */
  public static final String DEBUG_HEADER = "X-Debug-Member";

  /** Same manager scope the prod chain gates on, granted to seeded MANAGER members. */
  public static final String MANAGER_SCOPE = "SCOPE_reconcile:commits";

  @Bean
  public SecurityFilterChain e2eSecurityFilterChain(HttpSecurity http, MemberRepository members)
      throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/graph/callback")
                    .permitAll()
                    // Hermetic per-scenario test maintenance (reset / inject-item); no
                    // X-Debug-Member, e2e profile only.
                    .requestMatchers(HttpMethod.POST, "/api/e2e/**")
                    .permitAll()
                    // Same manager-only route set as the prod chain.
                    .requestMatchers(HttpMethod.GET, "/api/rollup", "/api/rollup/**")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.GET, "/api/review-queue", "/api/review-queue/**")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.POST, "/api/commits/*/review")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.POST, "/api/commits/*/reconcile")
                    .hasAuthority(MANAGER_SCOPE)
                    .requestMatchers(HttpMethod.POST, "/api/commits/*/reconciled")
                    .hasAuthority(MANAGER_SCOPE)
                    .anyRequest()
                    .authenticated())
        // Same RFC-7807 problem+json bodies on filter-chain denials as the prod chain: an anonymous
        // request -> 401 (code unauthorized), an authenticated non-manager on a manager route ->
        // 403
        // (code forbidden), each with a body rather than the empty default.
        .exceptionHandling(
            ex ->
                ex.authenticationEntryPoint(ProblemAuthHandlers.unauthorizedEntryPoint())
                    .accessDeniedHandler(ProblemAuthHandlers.forbiddenHandler()))
        .addFilterBefore(
            new DebugMemberFilter(members), UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }

  /**
   * Resolves the X-Debug-Member header to a seeded member and authenticates the request as that
   * member. No header (or an unknown value) leaves the request anonymous, so protected routes still
   * 401/403. MANAGER members carry SCOPE_reconcile:commits, mirroring the prod scope mapping.
   */
  static final class DebugMemberFilter extends OncePerRequestFilter {

    private final MemberRepository members;

    DebugMemberFilter(MemberRepository members) {
      this.members = members;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
      String header = request.getHeader(DEBUG_HEADER);
      if (header != null && !header.isBlank()) {
        resolve(header.trim())
            .ifPresent(
                member ->
                    SecurityContextHolder.getContext()
                        .setAuthentication(new DebugMemberAuthentication(member)));
      }
      chain.doFilter(request, response);
    }

    /**
     * Match the header by email, then by the seeded "auth0|seed-<slug>" subject, then raw subject.
     */
    private Optional<Member> resolve(String value) {
      Optional<Member> byEmail = members.findByEmail(value);
      if (byEmail.isPresent()) {
        return byEmail;
      }
      Optional<Member> bySeedSlug = members.findByAuth0Subject("auth0|seed-" + value);
      if (bySeedSlug.isPresent()) {
        return bySeedSlug;
      }
      return members.findByAuth0Subject(value);
    }
  }

  /** An authenticated token whose principal is the resolved member's id (read by the provider). */
  static final class DebugMemberAuthentication extends AbstractAuthenticationToken {

    private final java.util.UUID memberId;

    DebugMemberAuthentication(Member member) {
      super(authoritiesFor(member));
      this.memberId = member.getId();
      setAuthenticated(true);
    }

    private static List<GrantedAuthority> authoritiesFor(Member member) {
      return member.getRole() == MemberRole.MANAGER
          ? List.of(new SimpleGrantedAuthority(MANAGER_SCOPE))
          : List.of();
    }

    @Override
    public Object getCredentials() {
      return "";
    }

    @Override
    public Object getPrincipal() {
      return memberId;
    }
  }
}
