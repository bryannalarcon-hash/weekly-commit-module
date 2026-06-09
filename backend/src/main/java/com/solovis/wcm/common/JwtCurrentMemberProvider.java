// JwtCurrentMemberProvider — the production CurrentMemberProvider (U15). Resolves the acting Member
// from the validated Auth0 JWT in the SecurityContext: the subject ("sub") is the stable identity
// key, JIT-provisioned to a Member via MemberProvisioningService (findOrProvision). This is the
// trusted identity seam (KTD6) — WHO is acting comes from the token, never a request body — so the
// ownership/row-level checks in the services can be relied on. Replaces the dev X-Debug-Member
// impl.
package com.solovis.wcm.common;

import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberProvisioningService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class JwtCurrentMemberProvider implements CurrentMemberProvider {

  /** Common OIDC claim names used to seed a freshly provisioned Member. */
  private static final String EMAIL_CLAIM = "email";

  private static final String NAME_CLAIM = "name";

  private final MemberProvisioningService provisioning;

  public JwtCurrentMemberProvider(MemberProvisioningService provisioning) {
    this.provisioning = provisioning;
  }

  @Override
  public Member currentMember() {
    Jwt jwt = currentJwt();
    String subject = jwt.getSubject();
    if (subject == null || subject.isBlank()) {
      throw new UnresolvedMemberException("authenticated token has no subject claim");
    }
    return provisioning.findOrProvision(
        subject, jwt.getClaimAsString(EMAIL_CLAIM), jwt.getClaimAsString(NAME_CLAIM));
  }

  /** The validated JWT for the current request, or 401 if the caller is unauthenticated. */
  private Jwt currentJwt() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication != null
        && authentication.isAuthenticated()
        && authentication.getPrincipal() instanceof Jwt jwt) {
      return jwt;
    }
    throw new UnresolvedMemberException("no authenticated JWT on the current request");
  }
}
