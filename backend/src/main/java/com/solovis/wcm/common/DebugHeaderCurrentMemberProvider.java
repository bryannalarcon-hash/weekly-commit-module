// DebugHeaderCurrentMemberProvider — the HERMETIC E2E CurrentMemberProvider (KTD13), active ONLY
// under the "e2e" profile. It resolves the acting Member from the authentication established by
// E2eSecurityConfig's X-Debug-Member filter: that filter validates the header against a seeded
// Member and stores the Member's id as the authentication principal, so this provider just re-loads
// it from MemberRepository. This is a test-only seam — it NEVER ships in prod (the prod path is
// JwtCurrentMemberProvider, @Profile("!e2e")), and there is no product fallback to it.
package com.solovis.wcm.common;

import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Profile("e2e")
public class DebugHeaderCurrentMemberProvider implements CurrentMemberProvider {

  private final MemberRepository members;

  public DebugHeaderCurrentMemberProvider(MemberRepository members) {
    this.members = members;
  }

  @Override
  public Member currentMember() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null
        || !authentication.isAuthenticated()
        || !(authentication.getPrincipal() instanceof UUID memberId)) {
      throw new UnresolvedMemberException("no X-Debug-Member identity on the current request");
    }
    return members
        .findById(memberId)
        .orElseThrow(
            () -> new UnresolvedMemberException("debug member " + memberId + " no longer exists"));
  }
}
